"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createShipmentLabel } from "@/lib/mondial-relay/operations";
import { uploadShippingLabel } from "@/lib/storage/marketplace-r2";
import { getResendClient } from "@/lib/email/client";
import { buildMarketplaceShippedNotificationEmail } from "@/lib/email/templates/marketplace-shipped-notification";

// =============================================================================
// Server Action : markOrderAsShipped
// =============================================================================
// Flow seller :
//   1. Auth + ownership (seller_user_id == auth.uid())
//   2. Status check (paid_awaiting_shipment uniquement)
//   3. Idempotence : si tracking_number déjà set → no-op
//   4. Vérif carrier supporté + relay_point_id présent
//   5. Vérif shipping_from_* complet sur seller_account
//   6. Charge buyer email (auth.users via admin)
//   7. Appel MR V2 createShipmentLabel
//   8. Download PDF depuis labelUrl MR
//   9. Upload R2 (bucket privé) via uploadShippingLabel
//  10. UPDATE order : status='shipped', tracking, label_path, shipped_at
//      Garde-fou : eq("status","paid_awaiting_shipment") pour idempotence
//  11. INSERT audit_log
//  12. Mail buyer (best effort, non-bloquant)
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const markShippedSchema = z.object({
    orderId: z.string().uuid(),
});

/**
 * Normalise un téléphone pour MR V2.
 * MR exige un format strict par pays (cf doc V2.7.1) :
 *   BE : ^[4]?[0-9]{8}$ (mobile = 4 + 8 chiffres)
 *   FR : ^[1-9][0-9]{8}$ (9 chiffres sans 0 préfixe)
 * On strip espaces, séparateurs, code pays international, et le 0 préfixe national.
 */
function normalizePhoneForMR(phone: string, country: "BE" | "FR"): string {
    let p = phone.replace(/[\s.\-()+]/g, "");
    if (p.startsWith("00")) p = p.slice(2);
    if (country === "BE" && p.startsWith("32")) p = p.slice(2);
    if (country === "FR" && p.startsWith("33")) p = p.slice(2);
    if (p.startsWith("0")) p = p.slice(1);
    return p;
}

export async function markOrderAsShipped(input: {
    orderId: string;
}): Promise<ActionResult<{ tracking_number: string }>> {
    const parsed = markShippedSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const admin = createAdminClient();

    // --- 1. Charge l'order avec join listing
    const { data: order, error: orderErr } = await admin
        .from("marketplace_orders")
        .select(`
            id, listing_id, buyer_user_id, seller_user_id, status, shipping_carrier,
            relay_point_id, shipping_full_name, shipping_line1, shipping_line2,
            shipping_postal_code, shipping_city, shipping_country, shipping_phone,
            tracking_number, shipping_label_storage_path,
            listing:marketplace_listings!listing_id(title, weight_grams)
        `)
        .eq("id", parsed.data.orderId)
        .maybeSingle();

    if (orderErr || !order) {
        return { ok: false, error: { code: "ORDER_NOT_FOUND", message: "Commande introuvable" } };
    }
    if (order.seller_user_id !== user.id) {
        return { ok: false, error: { code: "FORBIDDEN", message: "Tu n'es pas le vendeur de cette commande" } };
    }

    // --- 2. Idempotence : déjà expédié ?
    if (order.status === "shipped" && order.tracking_number) {
        return { ok: true, data: { tracking_number: order.tracking_number } };
    }
    if (order.status !== "paid_awaiting_shipment") {
        return {
            ok: false,
            error: {
                code: "INVALID_STATUS",
                message: `La commande est en statut '${order.status}', impossible d'expédier`,
            },
        };
    }

    // --- 3. Vérif carrier
    if (order.shipping_carrier !== "mondial_relay") {
        return {
            ok: false,
            error: {
                code: "CARRIER_NOT_SUPPORTED",
                message: "Seul Mondial Relay est implémenté pour l'instant",
            },
        };
    }
    if (!order.relay_point_id) {
        return { ok: false, error: { code: "NO_RELAY", message: "Point relais manquant sur la commande" } };
    }

    // --- 4. Charge seller_account (shipping_from_* + nom légal pour Sender étiquette)
    const { data: sellerAccount } = await admin
        .from("marketplace_seller_accounts")
        .select(`
            kyc_status,
            dac7_legal_first_name, dac7_legal_last_name,
            shipping_from_line1, shipping_from_postal_code, shipping_from_city,
            shipping_from_country, shipping_from_phone
        `)
        .eq("user_id", user.id)
        .maybeSingle();

    if (!sellerAccount) {
        return { ok: false, error: { code: "NO_SELLER_ACCOUNT", message: "Compte vendeur introuvable" } };
    }

    const missing: string[] = [];
    if (!sellerAccount.shipping_from_line1) missing.push("adresse");
    if (!sellerAccount.shipping_from_postal_code) missing.push("code postal");
    if (!sellerAccount.shipping_from_city) missing.push("ville");
    if (!sellerAccount.shipping_from_country) missing.push("pays");
    if (!sellerAccount.shipping_from_phone) missing.push("téléphone");
    if (missing.length > 0) {
        return {
            ok: false,
            error: {
                code: "INCOMPLETE_SHIPPING_ADDRESS",
                message: `Adresse d'expédition incomplète (${missing.join(", ")}). Va sur ton profil vendeur pour la compléter.`,
            },
        };
    }
    if (!sellerAccount.dac7_legal_first_name || !sellerAccount.dac7_legal_last_name) {
        return {
            ok: false,
            error: {
                code: "INCOMPLETE_KYC",
                message: "Nom légal KYC manquant. Termine ton inscription vendeur.",
            },
        };
    }

    // --- 5. Charge buyer email (depuis auth.users via admin)
    const { data: authBuyer } = await admin.auth.admin.getUserById(order.buyer_user_id);
    const buyerEmail = authBuyer?.user?.email ?? null;
    if (!buyerEmail) {
        return { ok: false, error: { code: "BUYER_EMAIL_NOT_FOUND", message: "Email acheteur introuvable" } };
    }

    const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing;
    const listingTitle = listing?.title ?? "Annonce";
    const weightGrams = Math.max(listing?.weight_grams ?? 1000, 100);

    // --- 6. Création étiquette MR V2
    const sellerCountry = sellerAccount.shipping_from_country as "BE" | "FR";
    const buyerCountry = order.shipping_country as "BE" | "FR";

    let labelResult: { expeditionNumber: string; labelUrl: string };
    try {
        labelResult = await createShipmentLabel({
            // OrderNo MR : max 15 chars, [0-9A-Z_ -]
            dossier: order.id.replace(/-/g, "").slice(0, 15).toUpperCase(),
            sender: {
                name: `${sellerAccount.dac7_legal_first_name} ${sellerAccount.dac7_legal_last_name}`.toUpperCase(),
                line2: sellerAccount.shipping_from_line1!,
                city: sellerAccount.shipping_from_city!,
                postalCode: sellerAccount.shipping_from_postal_code!,
                country: sellerCountry,
                phone: normalizePhoneForMR(sellerAccount.shipping_from_phone!, sellerCountry),
                email: user.email ?? "",
            },
            recipient: {
                name: order.shipping_full_name.toUpperCase(),
                line1: order.shipping_line2 ?? undefined,
                line2: order.shipping_line1,
                city: order.shipping_city,
                postalCode: order.shipping_postal_code,
                country: buyerCountry,
                phone: order.shipping_phone
                    ? normalizePhoneForMR(order.shipping_phone, buyerCountry)
                    : "",
                email: buyerEmail,
            },
            weightGrams,
            relay: { country: buyerCountry, id: order.relay_point_id },
            description: listingTitle.slice(0, 40),
        });
    } catch (err) {
        return {
            ok: false,
            error: {
                code: "MR_LABEL_FAILED",
                message: err instanceof Error ? err.message : "Création étiquette MR échouée",
            },
        };
    }

    // --- 7. Download PDF depuis MR
    let pdfBuffer: Buffer;
    try {
        const pdfRes = await fetch(labelResult.labelUrl);
        if (!pdfRes.ok) {
            throw new Error(`MR PDF HTTP ${pdfRes.status} ${pdfRes.statusText}`);
        }
        pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    } catch (err) {
        return {
            ok: false,
            error: {
                code: "PDF_DOWNLOAD_FAILED",
                message: err instanceof Error ? err.message : "Téléchargement PDF échoué",
            },
        };
    }

    // --- 8. Upload R2 privé
    let storageKey: string;
    try {
        const uploadRes = await uploadShippingLabel(order.id, pdfBuffer);
        storageKey = uploadRes.key;
    } catch (err) {
        return {
            ok: false,
            error: {
                code: "R2_UPLOAD_FAILED",
                message: err instanceof Error ? err.message : "Upload R2 échoué",
            },
        };
    }

    // --- 9. UPDATE order avec garde-fou status (idempotence forte)
    const now = new Date().toISOString();
    const { error: updateErr, data: updated } = await admin
        .from("marketplace_orders")
        .update({
            status: "shipped",
            tracking_number: labelResult.expeditionNumber,
            shipping_label_storage_path: storageKey,
            shipped_at: now,
        })
        .eq("id", order.id)
        .eq("status", "paid_awaiting_shipment") // garde-fou : si concurrent run, l'autre a déjà fait
        .select("id")
        .single();

    if (updateErr || !updated) {
        // Rollback R2 : on a uploadé une étiquette qu'on ne va plus utiliser ;
        // mais on ne supprime pas car l'autre run a peut-être déjà persisté
        // le même chemin (idempotent côté R2 : key fixe shipping-labels/{order_id}.pdf).
        return {
            ok: false,
            error: {
                code: "DB_UPDATE_FAILED",
                message: updateErr?.message ?? "Update order échoué (concurrent run ?)",
            },
        };
    }

    // --- 10. Audit log
    await admin.from("audit_log").insert({
        actor_user_id: user.id,
        action: "marketplace_order.shipped",
        target_type: "marketplace_order",
        target_id: order.id,
        payload: {
            tracking_number: labelResult.expeditionNumber,
            shipping_label_storage_path: storageKey,
            carrier: "mondial_relay",
            relay_point_id: order.relay_point_id,
        },
    });

    // --- 11. Mail buyer (best-effort, non bloquant)
    try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
        const trackingUrl = `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${labelResult.expeditionNumber}`;
        const orderUrl = `${baseUrl}/profil/marketplace/commandes/${order.id}`;

        const { text, html } = buildMarketplaceShippedNotificationEmail({
            buyerFullName: order.shipping_full_name,
            sellerFullName: `${sellerAccount.dac7_legal_first_name} ${sellerAccount.dac7_legal_last_name}`,
            listingTitle,
            trackingNumber: labelResult.expeditionNumber,
            trackingUrl,
            relayPointId: order.relay_point_id,
            orderUrl,
        });

        const resend = getResendClient();
        await resend.emails.send({
            from: "Sente <notifications@lasente.eu>",
            to: [buyerEmail],
            subject: `Ton colis est en route — ${listingTitle}`,
            text,
            html,
        });
    } catch (err) {
        // L'expédition reste validée même si le mail plante : on log et on continue
        console.error("[markOrderAsShipped] mail buyer failed (non-blocking):", err);
    }

    revalidatePath(`/profil/marketplace/commandes/${order.id}`);
    revalidatePath(`/profil/marketplace/ventes`);

    return {
        ok: true,
        data: { tracking_number: labelResult.expeditionNumber },
    };
}