import { z } from "zod";
import { ProvinceSchema, PaysSchema, type Province } from "@/lib/schemas/lieu";
import {SPECIALITES_MAGASIN, type SpecialiteValue} from "@/lib/constants/specialites";

const SPECIALITE_VALUES = SPECIALITES_MAGASIN.map((s) => s.value) as [
    SpecialiteValue,
    ...SpecialiteValue[]
];

export const SpecialiteSchema = z.enum(SPECIALITE_VALUES);
export type Specialite = SpecialiteValue;

// Compat — SpecialiteLabel toujours exporté pour les endroits qui l'importent encore
export { SPECIALITE_LABEL as SpecialiteLabel } from "@/lib/constants/specialites";

export const MagasinSchema = z.object({
    id: z.string().min(1),
    slug: z.string().min(1),
    nom: z.string(),
    description: z.string(),
    pays: PaysSchema.default("BE"),
    province: ProvinceSchema,
    ville: z.string(),
    adresse: z.string(),
    specialites: z.array(SpecialiteSchema),
    marques: z.array(z.string()),
    horaires: z.string(),
    photos: z.array(z.string().url()).min(1),
    coordonnees: z.object({ lat: z.number(), lng: z.number() }),
    contact: z.object({
        telephone: z.string().optional(),
        email: z.string().email().optional(),
        siteWeb: z.string().url().optional(),
        instagram: z.string().optional(),
    }),
    partenaire: z.boolean(),
    noteMoyenne: z.number().min(0).max(5).optional(),
    nbAvis: z.number().int().nonnegative(),
});
export type Magasin = z.infer<typeof MagasinSchema>;

export const MagasinsFilterSchema = z.object({
    pays: PaysSchema.optional(),
    specialite: SpecialiteSchema.optional(),
    province: ProvinceSchema.optional(),
    partenaireOnly: z.boolean().optional(),
});
export type MagasinsFilter = z.infer<typeof MagasinsFilterSchema>;

export type { Province };