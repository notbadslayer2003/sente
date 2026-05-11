import { z } from "zod";
import crypto from "node:crypto";

// =============================================================================
// Sendcloud webhook — verification + parsing
// =============================================================================
// Sendcloud envoie un POST avec un header Sendcloud-Signature contenant le HMAC
// SHA-256 du body brut, signé avec le webhook secret défini dans le panel.
// =============================================================================

/**
 * Vérifie la signature HMAC SHA-256 d'un webhook Sendcloud.
 * Comparaison constante-time pour éviter les timing attacks.
 */
export function verifySendcloudSignature(
    rawBody: string,
    signatureHeader: string | null,
    secret: string
): boolean {
    if (!signatureHeader) return false;
    const expected = crypto
        .createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("hex");
    try {
        return crypto.timingSafeEqual(
            Buffer.from(expected, "hex"),
            Buffer.from(signatureHeader, "hex")
        );
    } catch {
        return false;
    }
}

// -----------------------------------------------------------------------------
// Schema permissif du payload — Sendcloud peut évoluer, on prend large et on
// calibrera après le premier vrai hit.
// -----------------------------------------------------------------------------

const SendcloudWebhookSchema = z
    .object({
        action: z.string().optional(),
        timestamp: z.union([z.number(), z.string()]).optional(),
        parcel: z
            .object({
                id: z.union([z.number(), z.string()]),
                tracking_number: z.string().nullable().optional(),
                status: z
                    .object({
                        id: z.union([z.number(), z.string()]).optional(),
                        message: z.string().optional(),
                    })
                    .passthrough()
                    .nullable()
                    .optional(),
            })
            .passthrough(),
    })
    .passthrough();

export type SendcloudWebhookEvent = z.infer<typeof SendcloudWebhookSchema>;

export function parseSendcloudWebhook(rawJson: unknown): SendcloudWebhookEvent {
    return SendcloudWebhookSchema.parse(rawJson);
}

// -----------------------------------------------------------------------------
// Mapping status → action métier.
//
// Sendcloud parcel statuses (codes officiels les plus fréquents) :
//   11   Delivered (à domicile bpost OU récupéré chez MR par le buyer)
//   1337 Awaiting customer pickup (arrivé au relais MR, pas encore récupéré)
//   12   Cancelled by carrier
//   13   Returned to sender
//   91   Lost
//
// Decision Mathis : "delivered" déclenche T+48h SEULEMENT quand le buyer a
// effectivement réceptionné — donc on agit sur le code 11 (pas sur 1337).
//
// IMPORTANT : ces codes sont à valider après le premier vrai hit réel.
// La const ci-dessous est facile à ajuster.
// -----------------------------------------------------------------------------

export const DELIVERED_STATUS_CODES = new Set<number>([11]);
export const PROBLEM_STATUS_CODES = new Set<number>([12, 13, 91]);

export type WebhookOutcome =
    | { type: "delivered"; parcelId: number; trackingNumber: string | null }
    | {
    type: "problem";
    parcelId: number;
    trackingNumber: string | null;
    statusCode: number;
    statusMessage: string;
}
    | { type: "noop"; parcelId: number; statusCode: number | null };

export function classifyWebhook(event: SendcloudWebhookEvent): WebhookOutcome {
    const parcel = event.parcel;
    const parcelId =
        typeof parcel.id === "string" ? parseInt(parcel.id, 10) : parcel.id;
    const trackingNumber = parcel.tracking_number ?? null;

    const rawStatusId = parcel.status?.id;
    const statusCode =
        typeof rawStatusId === "string" ? parseInt(rawStatusId, 10) : rawStatusId ?? null;

    if (statusCode !== null && DELIVERED_STATUS_CODES.has(statusCode)) {
        return { type: "delivered", parcelId, trackingNumber };
    }
    if (statusCode !== null && PROBLEM_STATUS_CODES.has(statusCode)) {
        return {
            type: "problem",
            parcelId,
            trackingNumber,
            statusCode,
            statusMessage: parcel.status?.message ?? "Unknown problem",
        };
    }
    return { type: "noop", parcelId, statusCode };
}

/**
 * Calcule un event_id stable pour idempotence.
 * Sendcloud n'a pas d'event_id natif → on hash parcel_id + status + timestamp.
 */
export function computeEventId(event: SendcloudWebhookEvent): string {
    const parcel = event.parcel;
    const parcelId = String(parcel.id);
    const statusId = String(parcel.status?.id ?? "");
    const ts = String(event.timestamp ?? "");
    return crypto
        .createHash("sha256")
        .update(`${parcelId}:${statusId}:${ts}`)
        .digest("hex");
}