"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedUrlForPrivateKey } from "@/lib/storage/marketplace-r2";

// =============================================================================
// Server Action : getMyShippingLabelUrl
// =============================================================================
// Retourne une signed URL temporaire (5 min) vers le PDF d'étiquette R2.
// Réservé au seller propriétaire de la commande. Le buyer n'a pas accès au PDF
// d'étiquette : seulement au tracking number et lien de suivi MR public.
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const schema = z.object({
    orderId: z.string().uuid(),
});

export async function getMyShippingLabelUrl(input: {
    orderId: string;
}): Promise<ActionResult<{ url: string }>> {
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
        .select("seller_user_id, shipping_label_storage_path, status")
        .eq("id", parsed.data.orderId)
        .maybeSingle();

    if (!order) {
        return { ok: false, error: { code: "ORDER_NOT_FOUND", message: "Commande introuvable" } };
    }
    if (order.seller_user_id !== user.id) {
        return { ok: false, error: { code: "FORBIDDEN", message: "Tu n'es pas le vendeur" } };
    }
    if (!order.shipping_label_storage_path) {
        return {
            ok: false,
            error: {
                code: "NO_LABEL",
                message: "Aucune étiquette générée — la commande n'est pas encore expédiée",
            },
        };
    }

    const url = await getSignedUrlForPrivateKey(order.shipping_label_storage_path, 300);
    return { ok: true, data: { url } };
}