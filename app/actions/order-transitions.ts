"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zUuid } from "@/lib/utils/zod-helpers";
import { getResendClient } from "@/lib/email/client";
import { buildOrderReadyForPickupEmail } from "@/lib/email/templates/order-ready-for-pickup";
import { buildOrderShippedEmail } from "@/lib/email/templates/order-shipped";
import { buildTrackingUrl } from "@/lib/utils/tracking-links";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

// =============================================================================
// 1. Marquer en préparation
// =============================================================================

const SimpleTransitionSchema = z.object({
    order_id: zUuid,
});

export async function markOrderPreparingAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = SimpleTransitionSchema.safeParse({
        order_id: formData.get("order_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_order_status", {
        p_order_id: parsed.data.order_id,
        p_new_status: "preparing",
    });

    if (error) {
        console.error("transition preparing failed:", error);
        return { ok: false, error: humanizeTransitionError(error.message) };
    }

    revalidatePath(`/dashboard/[slug]/commandes`, "page");
    revalidatePath(`/dashboard/[slug]/commandes/[id]`, "page");
    revalidatePath("/profil/commandes");
    return { ok: true };
}

// =============================================================================
// 2. Marquer prête à retirer (click_collect uniquement)
// =============================================================================

export async function markOrderReadyForPickupAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = SimpleTransitionSchema.safeParse({
        order_id: formData.get("order_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_order_status", {
        p_order_id: parsed.data.order_id,
        p_new_status: "ready_for_pickup",
    });

    if (error) {
        console.error("transition ready_for_pickup failed:", error);
        return { ok: false, error: humanizeTransitionError(error.message) };
    }

    // Email au buyer
    await sendOrderReadyForPickupEmail(parsed.data.order_id);

    revalidatePath(`/dashboard/[slug]/commandes`, "page");
    revalidatePath(`/dashboard/[slug]/commandes/[id]`, "page");
    revalidatePath("/profil/commandes");
    return { ok: true };
}

// =============================================================================
// 3. Marquer expédiée (shipping_* uniquement, avec tracking)
// =============================================================================

const MarkShippedSchema = z.object({
    order_id: zUuid,
    tracking_carrier: z
        .enum([
            "bpost",
            "dpd",
            "gls",
            "ups",
            "fedex",
            "dhl",
            "colissimo",
            "mondial_relay",
            "autre",
        ])
        .or(z.string().min(1).max(50)),
    tracking_number: z
        .string()
        .min(3, "Numéro trop court")
        .max(100, "Numéro trop long")
        .regex(/^[A-Za-z0-9\-]+$/, "Numéro invalide (lettres, chiffres, tirets uniquement)"),
});

export async function markOrderShippedAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = MarkShippedSchema.safeParse({
        order_id: formData.get("order_id"),
        tracking_carrier: formData.get("tracking_carrier"),
        tracking_number: formData.get("tracking_number"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Paramètres invalides",
        };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_order_status", {
        p_order_id: parsed.data.order_id,
        p_new_status: "shipped",
        p_tracking_carrier: parsed.data.tracking_carrier,
        p_tracking_number: parsed.data.tracking_number,
    });

    if (error) {
        console.error("transition shipped failed:", error);
        return { ok: false, error: humanizeTransitionError(error.message) };
    }

    // Email au buyer avec tracking
    await sendOrderShippedEmail(parsed.data.order_id);

    revalidatePath(`/dashboard/[slug]/commandes`, "page");
    revalidatePath(`/dashboard/[slug]/commandes/[id]`, "page");
    revalidatePath("/profil/commandes");
    return { ok: true };
}

// =============================================================================
// 4. Marquer livrée (depuis ready_for_pickup ou shipped)
// =============================================================================

export async function markOrderDeliveredAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = SimpleTransitionSchema.safeParse({
        order_id: formData.get("order_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("transition_order_status", {
        p_order_id: parsed.data.order_id,
        p_new_status: "delivered",
    });

    if (error) {
        console.error("transition delivered failed:", error);
        return { ok: false, error: humanizeTransitionError(error.message) };
    }

    revalidatePath(`/dashboard/[slug]/commandes`, "page");
    revalidatePath(`/dashboard/[slug]/commandes/[id]`, "page");
    revalidatePath("/profil/commandes");
    return { ok: true };
}

// =============================================================================
// 5. Annuler une commande (par magasin)
// =============================================================================

const CancelOrderSchema = z.object({
    order_id: zUuid,
    reason: z
        .string()
        .min(10, "Raison requise (min 10 caractères)")
        .max(1000, "Raison trop longue"),
});

export async function cancelOrderAsMagasinAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = CancelOrderSchema.safeParse({
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
    const { error } = await supabase.rpc("cancel_shop_order", {
        p_order_id: parsed.data.order_id,
        p_reason: parsed.data.reason,
    });

    if (error) {
        console.error("cancel_shop_order failed:", error);
        return { ok: false, error: humanizeTransitionError(error.message) };
    }

    revalidatePath(`/dashboard/[slug]/commandes`, "page");
    revalidatePath(`/dashboard/[slug]/commandes/[id]`, "page");
    revalidatePath("/profil/commandes");
    return { ok: true };
}

// =============================================================================
// Helpers email
// =============================================================================

async function sendOrderReadyForPickupEmail(orderId: string): Promise<void> {
    try {
        const admin = createAdminClient();
        const { data: order } = await admin
            .from("orders")
            .select(
                `id, customer_email, customer_name,
                 magasin:organizations!magasin_id(name, slug, address, city)`
            )
            .eq("id", orderId)
            .maybeSingle();

        if (!order || !order.customer_email) {
            console.warn(`No email for order ${orderId}, skip ready_for_pickup email`);
            return;
        }

        const magasin = Array.isArray(order.magasin) ? order.magasin[0] : order.magasin;

        const { text, html } = buildOrderReadyForPickupEmail({
            customerName: (order.customer_name as string) ?? "Pêcheur",
            orderId: order.id as string,
            magasinName: magasin?.name ?? "Sente",
            magasinAddress: magasin?.address ?? null,
            magasinCity: magasin?.city ?? null,
        });

        const resend = getResendClient();
        await resend.emails.send({
            from: "Sente <notifications@lasente.eu>",
            to: [order.customer_email as string],
            subject: `Ta commande est prête — ${magasin?.name ?? "Sente"}`,
            text,
            html,
        });
    } catch (err) {
        console.error("ready_for_pickup email failed:", err);
        // Pas de re-throw : la transition est faite, l'email est best-effort
    }
}

async function sendOrderShippedEmail(orderId: string): Promise<void> {
    try {
        const admin = createAdminClient();
        const { data: order } = await admin
            .from("orders")
            .select(
                `id, customer_email, customer_name,
                 tracking_carrier, tracking_number,
                 magasin:organizations!magasin_id(name)`
            )
            .eq("id", orderId)
            .maybeSingle();

        if (!order || !order.customer_email) {
            console.warn(`No email for order ${orderId}, skip shipped email`);
            return;
        }

        const magasin = Array.isArray(order.magasin) ? order.magasin[0] : order.magasin;
        const trackingUrl = buildTrackingUrl(
            order.tracking_carrier as string,
            order.tracking_number as string
        );

        const { text, html } = buildOrderShippedEmail({
            customerName: (order.customer_name as string) ?? "Pêcheur",
            orderId: order.id as string,
            magasinName: magasin?.name ?? "Sente",
            trackingCarrier: order.tracking_carrier as string,
            trackingNumber: order.tracking_number as string,
            trackingUrl,
        });

        const resend = getResendClient();
        await resend.emails.send({
            from: "Sente <notifications@lasente.eu>",
            to: [order.customer_email as string],
            subject: `Commande expédiée — ${magasin?.name ?? "Sente"}`,
            text,
            html,
        });
    } catch (err) {
        console.error("shipped email failed:", err);
    }
}

// =============================================================================
// Helpers humanisation erreurs
// =============================================================================

function humanizeTransitionError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("authentification requise")) return "Session expirée, reconnecte-toi.";
    if (lower.includes("accès refusé")) return "Accès refusé.";
    if (lower.includes("introuvable")) return "Commande introuvable.";
    if (lower.includes("statut") && lower.includes("paid")) {
        return "Cette commande n'est pas en attente de préparation.";
    }
    if (lower.includes("préparation") && lower.includes("avant")) {
        return "Tu dois d'abord marquer la commande en préparation.";
    }
    if (lower.includes("retrait en magasin") && lower.includes("réservé")) {
        return "Le statut \"prête à retirer\" est réservé aux commandes en retrait.";
    }
    if (lower.includes("retrait en magasin") && lower.includes("expédiée")) {
        return "Une commande en retrait ne peut pas être expédiée.";
    }
    if (lower.includes("transporteur requis")) return "Choisis un transporteur.";
    if (lower.includes("numéro de tracking")) return "Le numéro de tracking est requis.";
    if (lower.includes("a changé entre-temps")) {
        return "Le statut a changé pendant ton action. Recharge la page.";
    }
    if (lower.includes("livrée")) return "Cette commande est déjà livrée.";
    if (lower.includes("ne peut plus être annulée")) {
        return "Cette commande ne peut plus être annulée à ce stade.";
    }
    return msg;
}