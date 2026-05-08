"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient } from "@/lib/email/client";
import { buildMarketplaceDeliveredNotificationEmail } from "@/lib/email/templates/marketplace-delivered-notification";

// =============================================================================
// Server Action : confirmOrderReceived (côté buyer)
// =============================================================================
// Le buyer confirme la réception du colis :
//   shipped → delivered + delivered_at=now()
// Déclenche en aval : release escrow T+48h (étape 10), à coder plus tard.
// Mail seller "Ton acheteur a confirmé la livraison" envoyé en best-effort.
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const schema = z.object({
    orderId: z.string().uuid(),
});

export async function confirmOrderReceived(input: {
    orderId: string;
}): Promise<ActionResult> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const admin = createAdminClient();

    const { data: order } = await admin
        .from("marketplace_orders")
        .select(`
            id, buyer_user_id, seller_user_id, status,
            listing:marketplace_listings!listing_id(title)
        `)
        .eq("id", parsed.data.orderId)
        .maybeSingle();

    if (!order) {
        return { ok: false, error: { code: "ORDER_NOT_FOUND", message: "Commande introuvable" } };
    }
    if (order.buyer_user_id !== user.id) {
        return { ok: false, error: { code: "FORBIDDEN", message: "Tu n'es pas l'acheteur" } };
    }
    if (order.status === "delivered" || order.status === "released" || order.status === "closed") {
        return { ok: true, data: undefined }; // déjà confirmé, idempotent
    }
    if (order.status !== "shipped") {
        return {
            ok: false,
            error: {
                code: "INVALID_STATUS",
                message: `Statut '${order.status}' : confirmation impossible`,
            },
        };
    }

    // UPDATE avec garde-fou status (idempotence forte)
    const now = new Date().toISOString();
    const { error: updateErr, data: updated } = await admin
        .from("marketplace_orders")
        .update({ status: "delivered", delivered_at: now })
        .eq("id", order.id)
        .eq("status", "shipped")
        .select("id")
        .single();

    if (updateErr || !updated) {
        return {
            ok: false,
            error: { code: "DB_UPDATE_FAILED", message: updateErr?.message ?? "Update échoué" },
        };
    }

    // Audit log
    await admin.from("audit_log").insert({
        actor_user_id: user.id,
        action: "marketplace_order.confirmed_delivery",
        target_type: "marketplace_order",
        target_id: order.id,
        payload: { auto: false },
    });

    // Mail seller (best-effort)
    try {
        const { data: authSeller } = await admin.auth.admin.getUserById(order.seller_user_id);
        const sellerEmail = authSeller?.user?.email;
        if (sellerEmail) {
            const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing;
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
            const orderUrl = `${baseUrl}/profil/marketplace/commandes/${order.id}`;

            const { text, html } = buildMarketplaceDeliveredNotificationEmail({
                listingTitle: listing?.title ?? "Annonce",
                orderUrl,
            });

            const resend = getResendClient();
            await resend.emails.send({
                from: "Sente <notifications@lasente.eu>",
                to: [sellerEmail],
                subject: `Livraison confirmée — ${listing?.title ?? "ton annonce"}`,
                text,
                html,
            });
        }
    } catch (err) {
        console.error("[confirmOrderReceived] mail seller failed (non-blocking):", err);
    }

    revalidatePath(`/profil/marketplace/commandes/${order.id}`);
    revalidatePath(`/profil/marketplace/ventes`);

    return { ok: true, data: undefined };
}