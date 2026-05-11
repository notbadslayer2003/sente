import { z } from "zod";

// =============================================================================
// Sendcloud — schémas zod des responses API V2
// =============================================================================
// Note : certains champs sont .optional().nullable() parce que Sendcloud
// retourne des shapes légèrement différentes selon le carrier ou le contexte.
// On reste tolérant sur l'input ; on durcit si besoin après les premiers tests.
// =============================================================================

// -----------------------------------------------------------------------------
// Service Point
// -----------------------------------------------------------------------------

export const ServicePointSchema = z.object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
    street: z.string(),
    house_number: z.string().nullable().optional(),
    postal_code: z.string(),
    city: z.string(),
    country: z.string(), // ISO2
    carrier: z.string(),
    is_active: z.boolean().optional(),
    distance: z.number().nullable().optional(),
    latitude: z.string().nullable().optional(),
    longitude: z.string().nullable().optional(),
});

export const ServicePointsListSchema = z.array(ServicePointSchema);

// -----------------------------------------------------------------------------
// Shipping Method
// -----------------------------------------------------------------------------

export const ShippingMethodCountrySchema = z.object({
    id: z.number(),
    name: z.string(),
    iso_2: z.string(),
    iso_3: z.string(),
    price: z.number(), // EUR
});

export const ShippingMethodSchema = z.object({
    id: z.number(),
    name: z.string(),
    carrier: z.string(),
    min_weight: z.string(), // string formatted, en kg : "0.000"
    max_weight: z.string(),
    service_point_input: z
        .enum(["none", "required", "optional"])
        .nullable()
        .optional(),
    countries: z.array(ShippingMethodCountrySchema),
});

export const ShippingMethodsResponseSchema = z.object({
    shipping_methods: z.array(ShippingMethodSchema),
});

// -----------------------------------------------------------------------------
// Parcel (création + read)
// -----------------------------------------------------------------------------

export const ParcelLabelSchema = z.object({
    normal_printer: z.array(z.string()).nullable().optional(), // URLs PDF
    label_printer: z.string().nullable().optional(),
});

export const ParcelStatusSchema = z.object({
    id: z.number(),
    message: z.string(),
});

export const ParcelSchema = z.object({
    id: z.number(),
    tracking_number: z.string().nullable().optional(),
    tracking_url: z.string().nullable().optional(),
    label: ParcelLabelSchema.nullable().optional(),
    status: ParcelStatusSchema.nullable().optional(),
    carrier: z
        .object({ code: z.string().optional() })
        .nullable()
        .optional(),
    total_order_value: z.string().nullable().optional(),
    total_insured_value: z.number().nullable().optional(),
    shipment: z
        .object({ id: z.number(), name: z.string() })
        .nullable()
        .optional(),
});

export const CreateParcelResponseSchema = z.object({
    parcel: ParcelSchema,
});

// -----------------------------------------------------------------------------
// Tracking
// -----------------------------------------------------------------------------

export const TrackingStatusSchema = z.object({
    id: z.number(),
    message: z.string(),
    parent_status: z.string(), // "Delivered", "En route", "Announced", etc.
    carrier_message: z.string().nullable().optional(),
    timestamp: z.string(), // ISO datetime
});

export const TrackingResponseSchema = z.object({
    tracking_number: z.string(),
    carrier: z.string(),
    statuses: z.array(TrackingStatusSchema),
});