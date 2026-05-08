import { z } from "zod";

// =============================================================================
// Schemas zod V2 — ShipmentCreationResponse
// =============================================================================

const StatusEntrySchema = z.object({
    "@_Code": z.string().optional(),
    "@_Level": z.string().optional(),
    "@_Message": z.string().optional(),
}).passthrough();

const LabelSchema = z.object({
    Output: z.union([z.string(), z.object({}).passthrough()]).optional(),
    RawContent: z.unknown().optional(),
}).passthrough();

const ShipmentSchema = z.object({
    "@_ShipmentNumber": z.string().optional(),
    LabelList: z.object({
        Label: z.union([LabelSchema, z.array(LabelSchema)]).optional(),
    }).optional(),
}).passthrough();

export const ShipmentCreationResponseSchema = z.object({
    Context: z.unknown().optional(),
    OutputOptions: z.unknown().optional(),
    ShipmentsList: z.object({
        Shipment: z.union([ShipmentSchema, z.array(ShipmentSchema)]).optional(),
    }).optional(),
    StatusList: z.object({
        Status: z.union([StatusEntrySchema, z.array(StatusEntrySchema)]).optional(),
    }).optional().nullable(),
}).passthrough();

export type ShipmentCreationResponse = z.infer<typeof ShipmentCreationResponseSchema>;