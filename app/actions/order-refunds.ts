"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zUuid } from "@/lib/utils/zod-helpers";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

// =============================================================================
// 1. Refund par item (quantité fixe → montant proportionnel)
// =============================================================================

const RefundItemSchema = z.object({
    order_item_id: zUuid,
    refund_quantity: z
        .number()
        .int()
        .min(1, "Quantité minimum 1")
        .max(1000, "Quantité invalide"),
    reason: z
        .string()
        .min(10, "Raison requise (min 10 caractères)")
        .max(1000, "Raison trop longue"),
});

export async function refundOrderItemAction(
    formData: FormData
): Promise<ActionResult> {
    const qtyRaw = formData.get("refund_quantity");
    const parsed = RefundItemSchema.safeParse({
        order_item_id: formData.get("order_item_id"),
        refund_quantity:
            typeof qtyRaw === "string" && qtyRaw.length > 0
                ? parseInt(qtyRaw, 10)
                : undefined,
        reason: formData.get("reason"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Paramètres invalides",
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Authentification requise" };

    // Charge l'order_item + commande pour valider et calculer le montant
    const { data: item } = await supabase
        .from("order_items")
        .select(
            `id, order_id, quantity, refunded_quantity, unit_price_cents,
             line_total_cents, refunded_amount_cents,
             order:orders!order_id(
                id, magasin_id, status,
                stripe_payment_intent_id, stripe_charge_id,
                commission_rate_bps,
                magasin:organizations!magasin_id(stripe_account_id)
             )`
        )
        .eq("id", parsed.data.order_item_id)
        .maybeSingle();

    if (!item) return { ok: false, error: "Item de commande introuvable" };
    const order = Array.isArray(item.order) ? item.order[0] : item.order;
    if (!order) return { ok: false, error: "Commande introuvable" };

    // Validation : quantité refundable
    const remainingQty = item.quantity - item.refunded_quantity;
    if (parsed.data.refund_quantity > remainingQty) {
        return {
            ok: false,
            error: `Quantité max remboursable : ${remainingQty}`,
        };
    }

    // Statut compatible
    if (
        ![
            "paid",
            "preparing",
            "ready_for_pickup",
            "shipped",
            "delivered",
        ].includes(order.status)
    ) {
        return {
            ok: false,
            error: "Cette commande ne peut pas être remboursée à ce stade.",
        };
    }

    // Calcul montant proportionnel (b option : qty × unit_price)
    const refundAmount = parsed.data.refund_quantity * item.unit_price_cents;
    const commissionRefund = Math.round(
        (refundAmount * order.commission_rate_bps) / 10000
    );

    // Magasin Stripe account
    const magasin = Array.isArray(order.magasin)
        ? order.magasin[0]
        : order.magasin;
    const stripeAccountId = magasin?.stripe_account_id;
    if (!stripeAccountId) {
        return {
            ok: false,
            error: "Compte Stripe magasin manquant.",
        };
    }
    if (!order.stripe_payment_intent_id) {
        return {
            ok: false,
            error: "Aucun paiement Stripe associé à cette commande.",
        };
    }

    // 1. Refund Stripe d'abord (idempotent via metadata)
    const stripe = getStripeClient();
    let stripeRefund;
    try {
        stripeRefund = await stripe.refunds.create(
            {
                payment_intent: order.stripe_payment_intent_id,
                amount: refundAmount,
                reason: "requested_by_customer",
                refund_application_fee: true, // refund proportionnel de la commission Sente
                metadata: {
                    sente_kind: "shop_order_refund",
                    sente_order_id: order.id,
                    sente_order_item_id: item.id,
                    sente_refund_quantity: String(parsed.data.refund_quantity),
                    sente_refund_reason: parsed.data.reason,
                },
            },
            { stripeAccount: stripeAccountId }
        );
    } catch (err) {
        console.error("Stripe refund failed:", err);
        return {
            ok: false,
            error:
                err instanceof Error
                    ? `Erreur Stripe : ${err.message}`
                    : "Erreur Stripe",
        };
    }

    // 2. RPC DB côté Sente
    const { error: rpcError } = await supabase.rpc("record_order_item_refund", {
        p_order_item_id: parsed.data.order_item_id,
        p_refund_quantity: parsed.data.refund_quantity,
        p_refund_amount_cents: refundAmount,
        p_commission_refund_cents: commissionRefund,
        p_reason: parsed.data.reason,
        p_stripe_refund_id: stripeRefund.id,
        p_stripe_charge_id:
            (typeof stripeRefund.charge === "string"
                ? stripeRefund.charge
                : stripeRefund.charge?.id) ?? "",
    });

    if (rpcError) {
        console.error("record_order_item_refund failed:", rpcError);
        // Le refund Stripe est passé, mais notre DB n'est pas synchronisée.
        // Le webhook charge.refunded va rattraper via rattrapeShopOrderRefund.
        return {
            ok: false,
            error:
                "Remboursement Stripe effectué mais erreur de synchronisation. Le système rattrapera automatiquement.",
        };
    }

    revalidatePath(`/dashboard/[slug]/commandes`, "page");
    revalidatePath(`/dashboard/[slug]/commandes/[id]`, "page");
    revalidatePath("/profil/commandes");

    return { ok: true };
}

// =============================================================================
// 2. Refund frais de livraison
// =============================================================================

const RefundShippingSchema = z.object({
    order_id: zUuid,
    reason: z
        .string()
        .min(10, "Raison requise (min 10 caractères)")
        .max(1000, "Raison trop longue"),
});

export async function refundOrderShippingAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RefundShippingSchema.safeParse({
        order_id: formData.get("order_id"),
        reason: formData.get("reason"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Paramètres invalides",
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Authentification requise" };

    const { data: order } = await supabase
        .from("orders")
        .select(
            `id, magasin_id, status, shipping_cents,
             stripe_payment_intent_id, stripe_charge_id,
             magasin:organizations!magasin_id(stripe_account_id)`
        )
        .eq("id", parsed.data.order_id)
        .maybeSingle();

    if (!order) return { ok: false, error: "Commande introuvable" };

    if (order.shipping_cents === 0) {
        return {
            ok: false,
            error: "Cette commande n'a pas de frais de livraison.",
        };
    }

    if (
        ![
            "paid",
            "preparing",
            "ready_for_pickup",
            "shipped",
            "delivered",
        ].includes(order.status)
    ) {
        return {
            ok: false,
            error: "Cette commande ne peut pas être remboursée à ce stade.",
        };
    }

    const magasin = Array.isArray(order.magasin) ? order.magasin[0] : order.magasin;
    const stripeAccountId = magasin?.stripe_account_id;
    if (!stripeAccountId || !order.stripe_payment_intent_id) {
        return { ok: false, error: "Données Stripe manquantes." };
    }

    const stripe = getStripeClient();
    let stripeRefund;
    try {
        stripeRefund = await stripe.refunds.create(
            {
                payment_intent: order.stripe_payment_intent_id,
                amount: order.shipping_cents,
                reason: "requested_by_customer",
                metadata: {
                    sente_kind: "shop_order_refund",
                    sente_order_id: order.id,
                    sente_refund_target: "shipping",
                    sente_refund_reason: parsed.data.reason,
                },
            },
            { stripeAccount: stripeAccountId }
        );
    } catch (err) {
        console.error("Stripe shipping refund failed:", err);
        return {
            ok: false,
            error:
                err instanceof Error
                    ? `Erreur Stripe : ${err.message}`
                    : "Erreur Stripe",
        };
    }

    const { error: rpcError } = await supabase.rpc("record_shipping_refund", {
        p_order_id: parsed.data.order_id,
        p_refund_amount_cents: order.shipping_cents,
        p_reason: parsed.data.reason,
        p_stripe_refund_id: stripeRefund.id,
        p_stripe_charge_id:
            (typeof stripeRefund.charge === "string"
                ? stripeRefund.charge
                : stripeRefund.charge?.id) ?? "",
    });

    if (rpcError) {
        console.error("record_shipping_refund failed:", rpcError);
        return {
            ok: false,
            error: "Remboursement Stripe effectué mais erreur DB. Sera rattrapé par webhook.",
        };
    }

    revalidatePath(`/dashboard/[slug]/commandes`, "page");
    revalidatePath(`/dashboard/[slug]/commandes/[id]`, "page");
    revalidatePath("/profil/commandes");

    return { ok: true };
}

// =============================================================================
// 3. Refund total (tous items + port optionnel)
// =============================================================================

const RefundFullOrderSchema = z.object({
    order_id: zUuid,
    include_shipping: z.boolean(),
    reason: z
        .string()
        .min(10, "Raison requise (min 10 caractères)")
        .max(1000, "Raison trop longue"),
});

export async function refundFullOrderAction(
    formData: FormData
): Promise<ActionResult> {
    const includeShippingRaw = formData.get("include_shipping");

    const parsed = RefundFullOrderSchema.safeParse({
        order_id: formData.get("order_id"),
        include_shipping: includeShippingRaw === "true",
        reason: formData.get("reason"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Paramètres invalides",
        };
    }

    const supabase = await createClient();

    // Récup tous les items refundables
    const { data: items } = await supabase
        .from("order_items")
        .select("id, quantity, refunded_quantity")
        .eq("order_id", parsed.data.order_id);

    if (!items || items.length === 0) {
        return { ok: false, error: "Aucun item à rembourser" };
    }

    // Refund séquentiel item par item (pour avoir des refunds Stripe distincts)
    const errors: string[] = [];
    for (const item of items) {
        const remainingQty = item.quantity - item.refunded_quantity;
        if (remainingQty === 0) continue; // déjà tout refundé

        const fd = new FormData();
        fd.set("order_item_id", item.id);
        fd.set("refund_quantity", String(remainingQty));
        fd.set("reason", parsed.data.reason);

        const r = await refundOrderItemAction(fd);
        if (!r.ok) {
            errors.push(`Item ${item.id.slice(0, 8)}: ${r.error}`);
        }
    }

    // Refund port si demandé
    if (parsed.data.include_shipping) {
        const fd = new FormData();
        fd.set("order_id", parsed.data.order_id);
        fd.set("reason", parsed.data.reason);
        const r = await refundOrderShippingAction(fd);
        if (!r.ok && !r.error.includes("déjà remboursés") && !r.error.includes("pas de frais")) {
            errors.push(`Port : ${r.error}`);
        }
    }

    if (errors.length > 0) {
        return {
            ok: false,
            error: `Remboursement partiellement effectué. Erreurs : ${errors.join("; ")}`,
        };
    }

    return { ok: true };
}