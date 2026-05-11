import { sendcloudRequest, SendcloudError } from "./client";
import { z } from "zod";

const SERVICE_POINTS_BASE_URL = "https://servicepoints.sendcloud.sc/api/v2";

// =============================================================================
// Sendcloud V3 — operations
// =============================================================================
// Service Points : V2 endpoint sur sous-domaine séparé (compat V3).
// Shipping Options : V3 POST /shipping-options
// Création shipment : V3 POST /shipments/announce (synchrone)
// =============================================================================

export type SendcloudCarrier = "mondial_relay" | "bpost";

// Map vers les carrier_code Sendcloud
const CARRIER_CODE: Record<SendcloudCarrier, string> = {
    mondial_relay: "mondial_relay",
    bpost: "bpost",
};

export type ServicePoint = {
    id: string;
    code: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
    carrier: string;
};

// -----------------------------------------------------------------------------
// 1. Service Points (V2 endpoint, compat V3) — INCHANGÉ
// -----------------------------------------------------------------------------

const ServicePointSchema = z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
    street: z.string(),
    house_number: z.string().nullable().optional(),
    postal_code: z.string(),
    city: z.string(),
    country: z.string(),
    carrier: z.string(),
});

export async function searchServicePoints(input: {
    country: "BE" | "FR";
    postalCode: string;
    carrier?: SendcloudCarrier;
    weightGrams?: number;
    radiusMeters?: number;
}): Promise<ServicePoint[]> {
    const result = await sendcloudRequest("GET", "/service-points", {
        baseUrl: SERVICE_POINTS_BASE_URL,
        query: {
            country: input.country,
            address: input.postalCode,
            radius: input.radiusMeters ?? 5000,
            carrier: input.carrier ? CARRIER_CODE[input.carrier] : undefined,
            weight: input.weightGrams ? input.weightGrams / 1000 : undefined,
        },
        responseSchema: z.array(ServicePointSchema),
    });

    return result.map((sp) => ({
        id: String(sp.id),
        code: sp.code,
        name: sp.name,
        address: [sp.house_number, sp.street].filter(Boolean).join(" "),
        postalCode: sp.postal_code,
        city: sp.city,
        country: sp.country,
        carrier: sp.carrier,
    }));
}

// -----------------------------------------------------------------------------
// 2. Shipping Options + quotes (V3)
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// 2. Shipping Options + quotes (V3)
// -----------------------------------------------------------------------------

const QuoteV3Schema = z.object({
    price: z
        .object({
            total: z.object({
                value: z.string(),
                currency: z.string(),
            }),
            breakdown: z.array(z.unknown()).optional(),
        })
        .nullable()
        .optional(),
    lead_time: z.number().nullable().optional(),
});

const ShippingOptionV3Schema = z
    .object({
        code: z.string(),
        name: z.string(),
        carrier: z.object({ code: z.string() }),
        quotes: z.array(QuoteV3Schema).nullable().optional(),
        requirements: z
            .object({
                fields: z.array(z.unknown()).optional(),
                is_service_point_required: z.boolean().optional(),
                export_documents: z.boolean().optional(),
            })
            .passthrough()
            .nullable()
            .optional(),
        functionalities: z
            .object({
                last_mile: z.string().nullable().optional(),
            })
            .passthrough()
            .nullable()
            .optional(),
    })
    .passthrough();

const ShippingOptionsResponseSchema = z.object({
    data: z.array(ShippingOptionV3Schema),
});

function extractPriceCents(quotes: unknown): number | null {
    if (!Array.isArray(quotes) || quotes.length === 0) return null;
    const v = (quotes[0] as { price?: { total?: { value?: string } } })?.price
        ?.total?.value;
    if (v === undefined || v === null) return null;
    const n = parseFloat(String(v));
    return isNaN(n) ? null : Math.round(n * 100);
}

/**
 * Renvoie le shipping_option_code et le prix pour un envoi donné.
 */
export async function findShippingOption(input: {
    carrier: SendcloudCarrier;
    weightGrams: number;
    fromCountry: "BE" | "FR";
    toCountry: "BE" | "FR";
    requiresServicePoint: boolean;
}): Promise<{ code: string; name: string; priceCents: number }> {
    const body: Record<string, unknown> = {
        from_address: { country_code: input.fromCountry },
        to_address: { country_code: input.toCountry },
        carrier_code: CARRIER_CODE[input.carrier],
        calculate_quotes: true,
        weight: { value: (input.weightGrams / 1000).toFixed(3), unit: "kg" },
    };
    if (input.requiresServicePoint) {
        body.functionalities = { last_mile: "service_point" };
    }

    const result = await sendcloudRequest("POST", "/shipping-options", {
        body,
        responseSchema: ShippingOptionsResponseSchema,
    });

    if (result.data.length === 0) {
        throw new SendcloudError(
            `Aucune shipping option Sendcloud pour ${input.carrier} ${input.weightGrams}g ${input.fromCountry}→${input.toCountry}`,
            null,
            null,
            null
        );
    }

    // Trie par prix asc, options sans prix en queue
    const sorted = [...result.data].sort((a, b) => {
        const ap = extractPriceCents(a.quotes) ?? 999999999;
        const bp = extractPriceCents(b.quotes) ?? 999999999;
        return ap - bp;
    });

    const chosen = sorted[0];
    const priceCents = extractPriceCents(chosen.quotes);
    if (priceCents === null) {
        throw new SendcloudError(
            `Shipping option ${chosen.code} sans quote price`,
            null,
            null,
            chosen.quotes
        );
    }

    return {
        code: chosen.code,
        name: chosen.name,
        priceCents,
    };
}

// -----------------------------------------------------------------------------
// 3. Création shipment + label (V3 synchrone)
// -----------------------------------------------------------------------------

const idLike = z.union([z.string(), z.number()]);

const ParcelV3Schema = z
    .object({
        id: z.union([z.string(), z.number()]),
        tracking_number: z.string().nullable().optional(),
        tracking_url: z.string().nullable().optional(),
        label_file: z.string().nullable().optional(), // PDF en base64
        label_url: z.string().nullable().optional(), // fallback éventuel
        documents: z
            .array(
                z.object({
                    type: z.string(),
                    link: z.string(),
                })
            )
            .optional(),
        status: z
            .object({
                code: z.string().optional(),
                message: z.string().optional(),
            })
            .passthrough()
            .nullable()
            .optional(),
    })
    .passthrough();

const ShipmentV3Schema = z
    .object({
        id: z.union([z.string(), z.number()]), // UUID string en V3
        parcels: z.array(ParcelV3Schema),
        errors: z.array(z.unknown()).optional(),
        ship_with: z.unknown().optional(),
        carrier: z.object({ code: z.string() }).passthrough().optional(),
    })
    .passthrough();

const CreateShipmentResponseSchema = z
    .object({ data: ShipmentV3Schema.optional() })
    .passthrough();

export type CreateShipmentInput = {
    orderNumber: string;
    sender: {
        name: string;
        address: string;
        houseNumber?: string;
        postalCode: string;
        city: string;
        country: "BE" | "FR";
        phone: string;
        email: string;
    };
    recipient: {
        name: string;
        address: string;
        houseNumber?: string;
        postalCode: string;
        city: string;
        country: "BE" | "FR";
        phone?: string;
        email: string;
    };
    weightGrams: number;
    servicePointId?: string;
    shippingOptionCode: string;
};

export type CreateShipmentResult = {
    shipmentId: string; // UUID
    parcelId: number;
    trackingNumber: string;
    labelPdfBuffer: Buffer;
};


export async function createShipment(
    input: CreateShipmentInput
): Promise<CreateShipmentResult> {
    const body: Record<string, unknown> = {
        external_reference: input.orderNumber,
        from_address: {
            name: input.sender.name,
            address_line_1: input.sender.address,
            house_number: input.sender.houseNumber,
            postal_code: input.sender.postalCode,
            city: input.sender.city,
            country_code: input.sender.country,
            phone_number: input.sender.phone,
            email: input.sender.email,
        },
        to_address: {
            name: input.recipient.name,
            address_line_1: input.recipient.address,
            house_number: input.recipient.houseNumber,
            postal_code: input.recipient.postalCode,
            city: input.recipient.city,
            country_code: input.recipient.country,
            phone_number: input.recipient.phone,
            email: input.recipient.email,
        },
        ship_with: {
            type: "shipping_option_code",
            properties: { shipping_option_code: input.shippingOptionCode },
        },
        parcels: [
            {
                weight: {
                    value: (input.weightGrams / 1000).toFixed(3),
                    unit: "kg",
                },
            },
        ],
    };

    if (input.servicePointId) {
        body.to_service_point = { id: parseInt(input.servicePointId, 10) };
    }

    const result = await sendcloudRequest("POST", "/shipments/announce", {
        body,
        responseSchema: CreateShipmentResponseSchema,
    });

    const shipment = result.data;
    if (!shipment) {
        throw new SendcloudError("Réponse Sendcloud V3 sans data shipment", null, null, result);
    }
    if (shipment.errors && shipment.errors.length > 0) {
        throw new SendcloudError(
            `Sendcloud V3 announcement errors: ${JSON.stringify(shipment.errors)}`,
            null,
            null,
            shipment.errors
        );
    }

    const firstParcel = shipment.parcels[0];
    if (!firstParcel) {
        throw new SendcloudError("Shipment sans parcel", null, null, shipment);
    }

    const trackingNumber = firstParcel.tracking_number;
    if (!trackingNumber) {
        throw new SendcloudError("Parcel sans tracking_number", null, null, firstParcel);
    }

    // Le label PDF est en base64 dans parcels[0].label_file
    const labelBase64 = firstParcel.label_file;
    if (!labelBase64) {
        throw new SendcloudError(
            "Parcel sans label_file (base64)",
            null,
            null,
            firstParcel
        );
    }
    const labelPdfBuffer = Buffer.from(labelBase64, "base64");

    return {
        shipmentId: String(shipment.id),
        parcelId:
            typeof firstParcel.id === "string"
                ? parseInt(firstParcel.id, 10)
                : firstParcel.id,
        trackingNumber,
        labelPdfBuffer,
    };
}