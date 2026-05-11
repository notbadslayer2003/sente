"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    type SendcloudCarrier, createShipment, findShippingOption,
} from "@/lib/sendcloud/operations";
import { uploadShippingLabel } from "@/lib/storage/marketplace-r2";
import { getResendClient } from "@/lib/email/client";
import { buildMarketplaceShippedNotificationEmail } from "@/lib/email/templates/marketplace-shipped-notification";

// =============================================================================
// Server Action : markOrderAsShipped (Sendcloud)
// =============================================================================
// Flow seller : auth → status check → vérifs prérequis → Sendcloud (find method
// + create parcel + label) → download PDF → upload R2 → UPDATE order → audit →
// mail buyer.
//
// DETTE TECHNIQUE — pas de lock pessimiste contre double-clic seller :
// si seller double-clique sur "Marquer expédié", deux étiquettes Sendcloud
// peuvent être générées (et facturées). Le garde-fou DB protège la table mais
// pas l'API amont. À durcir avec un état `shipping_in_progress` sur l'enum +
// trigger SQL avant le live.
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const markShippedSchema = z.object({
    orderId: z.string().uuid(),
});

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

    // --- 1. Charge order
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

    // --- 2. Idempotence
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
    const carrier = order.shipping_carrier as string;
    if (carrier !== "mondial_relay" && carrier !== "bpost") {
        return {
            ok: false,
            error: { code: "CARRIER_NOT_SUPPORTED", message: `Carrier '${carrier}' non supporté` },
        };
    }
    if (carrier === "mondial_relay" && !order.relay_point_id) {
        return { ok: false, error: { code: "NO_RELAY", message: "Point relais manquant sur la commande" } };
    }

    // --- 4. Charge seller_account
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
            error: { code: "INCOMPLETE_KYC", message: "Nom légal KYC manquant. Termine ton inscription vendeur." },
        };
    }

    // --- 5. Charge buyer email
    const { data: authBuyer } = await admin.auth.admin.getUserById(order.buyer_user_id);
    const buyerEmail = authBuyer?.user?.email ?? null;
    if (!buyerEmail) {
        return { ok: false, error: { code: "BUYER_EMAIL_NOT_FOUND", message: "Email acheteur introuvable" } };
    }

    const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing;
    const listingTitle = listing?.title ?? "Annonce";
    const weightGrams = Math.max(listing?.weight_grams ?? 1000, 100);

    const sellerCountry = sellerAccount.shipping_from_country as "BE" | "FR";
    const buyerCountry = order.shipping_country as "BE" | "FR";

// --- 6. Sendcloud V3 : find option + create shipment + label
    const isTestMode =
        process.env.SENDCLOUD_TEST_MODE === "true" &&
        Boolean(process.env.SENDCLOUD_TEST_SHIPPING_OPTION_CODE);

    let shipmentResult: Awaited<ReturnType<typeof createShipment>>;
    let labelCostCents: number;
    let shippingOptionCode: string;

    try {
        if (isTestMode) {
            shippingOptionCode = process.env.SENDCLOUD_TEST_SHIPPING_OPTION_CODE!;
            labelCostCents = 0;
            console.log(
                `[markOrderAsShipped] TEST MODE — using ${shippingOptionCode}`
            );
        } else {
            const option = await findShippingOption({
                carrier: carrier as SendcloudCarrier,
                weightGrams,
                fromCountry: sellerCountry,
                toCountry: buyerCountry,
                requiresServicePoint: carrier === "mondial_relay",
            });
            shippingOptionCode = option.code;
            labelCostCents = option.priceCents;
        }

        shipmentResult = await createShipment({
            orderNumber: order.id.replace(/-/g, "").slice(0, 15).toUpperCase(),
            sender: {
                name: `${sellerAccount.dac7_legal_first_name} ${sellerAccount.dac7_legal_last_name}`,
                address: sellerAccount.shipping_from_line1!,
                postalCode: sellerAccount.shipping_from_postal_code!,
                city: sellerAccount.shipping_from_city!,
                country: sellerCountry,
                phone: sellerAccount.shipping_from_phone!,
                email: user.email ?? "",
            },
            recipient: {
                name: order.shipping_full_name,
                address: order.shipping_line1,
                postalCode: order.shipping_postal_code,
                city: order.shipping_city,
                country: buyerCountry,
                phone: order.shipping_phone ?? undefined,
                email: buyerEmail,
            },
            weightGrams,
            servicePointId: isTestMode ? undefined : (order.relay_point_id ?? undefined),
            shippingOptionCode,
        });
    } catch (err) {
        Sentry.captureException(err, {
            tags: { source: "markOrderAsShipped.sendcloud", orderId: order.id },
        });
        return {
            ok: false,
            error: {
                code: "SENDCLOUD_FAILED",
                message: err instanceof Error ? err.message : "Création shipment Sendcloud échouée",
            },
        };
    }

    // --- 7. Download PDF étiquette
    const pdfBuffer = shipmentResult.labelPdfBuffer;

    // --- 8. Upload R2 privé
    let storageKey: string;
    try {
        const uploadRes = await uploadShippingLabel(order.id, pdfBuffer);
        storageKey = uploadRes.key;
    } catch (err) {
        Sentry.captureException(err, {
            tags: { source: "markOrderAsShipped.r2", orderId: order.id },
            extra: { sendcloudParcelId: shipmentResult.parcelId },
        });
        return {
            ok: false,
            error: {
                code: "R2_UPLOAD_FAILED",
                message: err instanceof Error ? err.message : "Upload R2 échoué",
            },
        };
    }

    // --- 9. UPDATE order avec garde-fou status (idempotence DB)
    const now = new Date().toISOString();
    const { error: updateErr, data: updated } = await admin
        .from("marketplace_orders")
        .update({
            status: "shipped",
            tracking_number: shipmentResult.trackingNumber,
            shipping_label_storage_path: storageKey,
            shipping_label_cost_cents: labelCostCents,
            sendcloud_parcel_id: shipmentResult.parcelId,
            shipped_at: now,
        })
        .eq("id", order.id)
        .eq("status", "paid_awaiting_shipment")
        .select("id")
        .single();

    if (updateErr || !updated) {
        Sentry.captureException(updateErr ?? new Error("DB update failed after Sendcloud success"), {
            tags: { source: "markOrderAsShipped.db", orderId: order.id },
            extra: { sendcloudParcelId: shipmentResult.parcelId, trackingNumber: shipmentResult.trackingNumber },
        });
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
            tracking_number: shipmentResult.trackingNumber,
            sendcloud_parcel_id: shipmentResult.parcelId,
            shipping_label_storage_path: storageKey,
            shipping_label_cost_cents: labelCostCents,
            carrier,
            relay_point_id: order.relay_point_id,
        },
    });

    // --- 11. Mail buyer (best-effort)
    try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
        const trackingUrl =
            carrier === "mondial_relay"
                ? `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${shipmentResult.trackingNumber}`
                : `https://track.bpost.cloud/btr/web/#/search?itemCode=${shipmentResult.trackingNumber}`;
        const orderUrl = `${baseUrl}/profil/marketplace/commandes/${order.id}`;

        const { text, html } = buildMarketplaceShippedNotificationEmail({
            buyerFullName: order.shipping_full_name,
            sellerFullName: `${sellerAccount.dac7_legal_first_name} ${sellerAccount.dac7_legal_last_name}`,
            listingTitle,
            trackingNumber: shipmentResult.trackingNumber,
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
        console.error("[markOrderAsShipped] mail buyer failed (non-blocking):", err);
        Sentry.captureException(err, {
            tags: { source: "markOrderAsShipped.email", orderId: order.id },
        });
    }

    revalidatePath(`/profil/marketplace/commandes/${order.id}`);
    revalidatePath(`/profil/marketplace/ventes`);

    return { ok: true, data: { tracking_number: shipmentResult.trackingNumber } };
}