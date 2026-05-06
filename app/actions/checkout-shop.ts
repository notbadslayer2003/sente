"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { z } from "zod";
import { zUuid } from "@/lib/utils/zod-helpers";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const CheckoutShopSchema = z.object({
    cart_id: zUuid,
    delivery_method: z.enum([
        "click_collect",
        "shipping_standard",
        "shipping_local",
    ]),
});

/**
 * Crée une session Stripe Checkout pour un cart.
 *
 * Flow :
 *   1. Auth user
 *   2. RPC create_order_from_cart : crée order pending_payment + snapshot prix
 *   3. Build line_items Stripe à partir des order_items
 *   4. Stripe Checkout Session (direct charge sur le compte connecté)
 *   5. Persiste stripe_session_id sur la commande (via service_role)
 *   6. Retourne l'URL Stripe
 *
 * En cas d'échec après création de l'order (ex: Stripe down), on cancel
 * l'order pour restaurer le stock.
 */
export async function createShopCheckoutSessionAction(
    formData: FormData
): Promise<ActionResult<{ url: string; order_id: string }>> {
    const parsed = CheckoutShopSchema.safeParse({
        cart_id: formData.get("cart_id"),
        delivery_method: formData.get("delivery_method"),
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
    if (!user) return { ok: false, error: "Connecte-toi pour passer commande" };

    // Email confirmé requis pour tout acte payant (sécu)
    if (!user.email_confirmed_at) {
        return {
            ok: false,
            error: "Confirme ton email avant de passer commande.",
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Crée la commande en DB (RPC atomique)
    // ─────────────────────────────────────────────────────────────────────────
    const { data: rpcData, error: rpcError } = await supabase.rpc(
        "create_order_from_cart",
        {
            p_cart_id: parsed.data.cart_id,
            p_delivery_method: parsed.data.delivery_method,
        }
    );

    if (rpcError) {
        console.error("create_order_from_cart failed:", rpcError);
        return {
            ok: false,
            error: humanizeCheckoutError(rpcError.message),
        };
    }
    if (!rpcData) {
        return { ok: false, error: "Erreur inattendue lors de la création" };
    }

    // rpcData est un jsonb, on type-checke ce dont on a besoin
    const orderInfo = rpcData as {
        order_id: string;
        total_cents: number;
        subtotal_cents: number;
        shipping_cents: number;
        organization_id: string;
        stripe_account_id: string;
        application_fee_cents: number;
        delivery_method: string;
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Récupère les order_items pour construire les line_items Stripe
    // ─────────────────────────────────────────────────────────────────────────
    const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("product_name, variant_name, unit_price_cents, quantity")
        .eq("order_id", orderInfo.order_id);

    if (itemsError || !items || items.length === 0) {
        // Annule la commande si on n'arrive pas à récupérer les items
        await cancelOrderSilently(orderInfo.order_id);
        return { ok: false, error: "Erreur lors de la lecture des items" };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Crée la session Stripe Checkout
    // ─────────────────────────────────────────────────────────────────────────
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const stripe = getStripeClient();

    // Construction des line_items pour Stripe
    const lineItems = items.map((item) => ({
        price_data: {
            currency: "eur",
            product_data: {
                name: item.variant_name
                    ? `${item.product_name} — ${item.variant_name}`
                    : item.product_name,
            },
            unit_amount: item.unit_price_cents,
        },
        quantity: item.quantity,
    }));

    // Frais de livraison en line_item séparé (si > 0)
    // On ne les met PAS dans shipping_options Stripe pour éviter la double UI
    // (Stripe afficherait un sélecteur de livraison, alors qu'on en a déjà un côté Sente).
    if (orderInfo.shipping_cents > 0) {
        const shippingLabel =
            orderInfo.delivery_method === "shipping_standard"
                ? "Frais de livraison standard"
                : "Frais de livraison locale";
        lineItems.push({
            price_data: {
                currency: "eur",
                product_data: { name: shippingLabel },
                unit_amount: orderInfo.shipping_cents,
            },
            quantity: 1,
        });
    }

    let session;
    try {
        session = await stripe.checkout.sessions.create(
            {
                mode: "payment",
                line_items: lineItems,
                payment_intent_data: {
                    application_fee_amount: orderInfo.application_fee_cents,
                    metadata: {
                        sente_kind: "shop_order",
                        sente_order_id: orderInfo.order_id,
                        sente_org_id: orderInfo.organization_id,
                    },
                },
                customer_email: user.email,
                metadata: {
                    sente_kind: "shop_order",
                    sente_order_id: orderInfo.order_id,
                    sente_org_id: orderInfo.organization_id,
                },
                // Adresse uniquement pour les livraisons (pas pour click_collect)
                shipping_address_collection:
                    orderInfo.delivery_method === "click_collect"
                        ? undefined
                        : {
                            allowed_countries: ["BE", "FR"],
                        },
                phone_number_collection: { enabled: true },
                success_url: `${baseUrl}/panier/succes?order_id=${orderInfo.order_id}`,
                cancel_url: `${baseUrl}/panier?cancelled=1&order_id=${orderInfo.order_id}`,
                // 30 minutes d'expiration de la session (au-delà, l'order
                // restera en pending_payment et sera nettoyé par cron)
                expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
            },
            {
                stripeAccount: orderInfo.stripe_account_id,
            }
        );
    } catch (err) {
        console.error("Stripe checkout session create failed:", err);
        await cancelOrderSilently(orderInfo.order_id);
        return {
            ok: false,
            error:
                err instanceof Error
                    ? `Erreur Stripe : ${err.message}`
                    : "Erreur Stripe",
        };
    }

    if (!session.url) {
        await cancelOrderSilently(orderInfo.order_id);
        return { ok: false, error: "Stripe n'a pas retourné d'URL" };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Persiste le stripe_session_id sur la commande (via admin client
    // car la RLS bloquerait un UPDATE direct sur stripe_session_id)
    // ─────────────────────────────────────────────────────────────────────────
    const admin = createAdminClient();
    const { error: updateError } = await admin
        .from("orders")
        .update({ stripe_session_id: session.id })
        .eq("id", orderInfo.order_id);

    if (updateError) {
        console.error("Failed to persist stripe_session_id:", updateError);
        // On n'annule PAS la commande ici : la session Stripe est créée,
        // le user peut payer, et le webhook saura matcher via metadata.
        // On log pour debug et on continue.
    }

    return {
        ok: true,
        data: {
            url: session.url,
            order_id: orderInfo.order_id,
        },
    };
}

// =============================================================================
// Helper : annule silencieusement une commande en cas d'échec checkout
// =============================================================================
async function cancelOrderSilently(orderId: string): Promise<void> {
    try {
        const admin = createAdminClient();
        // On bypass la RPC cancel_shop_order qui requiert auth.uid() ;
        // ici on fait l'update direct depuis le service_role
        await admin
            .from("orders")
            .update({
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
                refund_reason: "Échec de création de la session Stripe",
            })
            .eq("id", orderId)
            .eq("status", "pending_payment");
    } catch (err) {
        console.error("Failed to cancel order silently:", err);
    }
}

// =============================================================================
// Humanisation erreurs
// =============================================================================
function humanizeCheckoutError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("connecte-toi")) return "Connecte-toi pour passer commande.";
    if (lower.includes("panier introuvable")) return "Panier introuvable.";
    if (lower.includes("paiements en ligne"))
        return "Ce magasin n'accepte pas encore les paiements en ligne.";
    if (lower.includes("mode de récupération"))
        return "Ce mode de récupération n'est pas disponible.";
    if (lower.includes("retrait en magasin")) return "Le retrait en magasin n'est pas activé.";
    if (lower.includes("livraison standard")) return "La livraison standard n'est pas activée.";
    if (lower.includes("livraison locale")) return "La livraison locale n'est pas activée.";
    if (lower.includes("plus disponible"))
        return "Un produit n'est plus disponible. Recharge le panier.";
    if (lower.includes("stock insuffisant")) return msg.replace(/^.*exception:\s*/i, "");
    if (lower.includes("panier vide")) return "Ton panier est vide.";
    if (lower.includes("incohérence")) return "Erreur dans le panier (recharge la page).";
    return "Erreur lors du checkout. Réessaie ou contacte le support.";
}