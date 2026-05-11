import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import {
    verifySendcloudSignature,
    parseSendcloudWebhook,
    classifyWebhook,
    computeEventId,
} from "@/lib/sendcloud/webhook";
import {Json} from "@/lib/database.types";

// =============================================================================
// POST /api/sendcloud/webhook
// =============================================================================
// 1. Lit le body brut
// 2. Vérifie la signature HMAC SHA-256 (header Sendcloud-Signature)
// 3. Idempotence : INSERT webhook_events(provider='sendcloud', event_id) →
//    conflit = déjà traité, on ignore
// 4. Classifie le status :
//    - delivered → UPDATE order status='delivered', delivered_at=now()
//    - problem → UPDATE order status='disputed', email admin via Sentry
//    - noop → log seulement
// 5. Toujours retourner 200 (sauf signature invalide → 401), sinon Sendcloud
//    spammera les retries.
// =============================================================================

export async function POST(request: NextRequest) {
    const secret = process.env.SENDCLOUD_WEBHOOK_SECRET;
    if (!secret) {
        Sentry.captureMessage("SENDCLOUD_WEBHOOK_SECRET non configuré", "error");
        return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }

    // 1. Body brut (nécessaire pour signature)
    const rawBody = await request.text();
    const signature = request.headers.get("sendcloud-signature");

    // 2. Signature
    if (!verifySendcloudSignature(rawBody, signature, secret)) {
        Sentry.captureMessage("Sendcloud webhook signature invalide", {
            level: "warning",
            extra: { signatureProvided: signature?.slice(0, 16) },
        });
        return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }

    // 3. Parse
    let event;
    try {
        const json = JSON.parse(rawBody);
        event = parseSendcloudWebhook(json);
    } catch (err) {
        Sentry.captureException(err, {
            tags: { source: "sendcloud_webhook.parse" },
            extra: { rawBody: rawBody.slice(0, 1000) },
        });
        // 200 quand même : si on retourne 4xx Sendcloud va retry sur du payload qu'on
        // ne sait pas parser, ça spammera. On log et on lâche.
        return NextResponse.json({ ok: true, ignored: "parse_failed" });
    }

    const admin = createAdminClient();
    const eventId = computeEventId(event);

    // 4. Idempotence
    const { error: insertErr } = await admin.from("webhook_events").insert({
        provider: "sendcloud",
        event_id: eventId,
        event_type: event.action ?? "parcel_status_changed",
        payload: event as unknown as Json,
    });

    if (insertErr) {
        // Conflit PK = déjà traité → on ignore proprement
        if (insertErr.code === "23505") {
            return NextResponse.json({ ok: true, idempotent: true });
        }
        Sentry.captureException(insertErr, {
            tags: { source: "sendcloud_webhook.insert" },
            extra: { eventId },
        });
        return NextResponse.json({ ok: true, ignored: "insert_failed" });
    }

    // 5. Classify + dispatch
    const outcome = classifyWebhook(event);

    try {
        if (outcome.type === "delivered") {
            const { data: order, error } = await admin
                .from("marketplace_orders")
                .update({ status: "delivered", delivered_at: new Date().toISOString() })
                .eq("sendcloud_parcel_id", outcome.parcelId)
                .eq("status", "shipped") // n'écrase pas un status terminal
                .select("id, buyer_user_id, seller_user_id")
                .maybeSingle();

            if (error) throw error;
            if (!order) {
                // Pas trouvé : test mode, ou l'order n'est plus en 'shipped'. Pas grave.
                console.log(`[sendcloud_webhook] no shipped order for parcel ${outcome.parcelId}`);
            } else {
                // TODO : audit_log (déclenché par trigger DB de toute façon)
                // TODO : notif buyer + email "votre colis est livré, T+48h avant release"
                console.log(`[sendcloud_webhook] order ${order.id} → delivered`);
            }
        } else if (outcome.type === "problem") {
            const { data: order, error } = await admin
                .from("marketplace_orders")
                .update({ status: "disputed" })
                .eq("sendcloud_parcel_id", outcome.parcelId)
                .neq("status", "released") // pas de retour en arrière sur les orders déjà payées
                .neq("status", "refunded")
                .select("id")
                .maybeSingle();

            if (error) throw error;

            Sentry.captureMessage("Sendcloud parcel problem", {
                level: "warning",
                tags: { source: "sendcloud_webhook.problem" },
                extra: {
                    parcelId: outcome.parcelId,
                    statusCode: outcome.statusCode,
                    statusMessage: outcome.statusMessage,
                    trackingNumber: outcome.trackingNumber,
                    orderId: order?.id ?? null,
                },
            });
        }
        // noop : on a déjà inséré dans webhook_events pour la traçabilité, c'est tout
    } catch (err) {
        Sentry.captureException(err, {
            tags: { source: "sendcloud_webhook.dispatch" },
            extra: { eventId, outcome },
        });
        // 200 quand même : le row est dans webhook_events, on retraitera manuellement si besoin
    }

    return NextResponse.json({ ok: true, outcome: outcome.type });
}