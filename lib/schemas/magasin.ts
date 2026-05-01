import { z } from "zod";
import { ProvinceSchema, type Province } from "@/lib/schemas/lieu";

export const SpecialiteSchema = z.enum([
    "carpe",
    "carnassier",
    "mouche",
    "peche-blanc",
    "peche-mer",
    "chasse",
    "general",
]);
export type Specialite = z.infer<typeof SpecialiteSchema>;

export const SpecialiteLabel: Record<Specialite, string> = {
    carpe: "Carpe",
    carnassier: "Carnassier",
    mouche: "Mouche",
    "peche-blanc": "Pêche blanc",
    "peche-mer": "Pêche mer",
    chasse: "Chasse",
    general: "Généraliste",
};

export const MagasinSchema = z.object({
    id: z.string().min(1), // TODO: passer en z.uuid() quand on branche Supabase
    slug: z.string().min(1),
    nom: z.string(),
    description: z.string(),
    province: ProvinceSchema,
    ville: z.string(),
    adresse: z.string(),
    specialites: z.array(SpecialiteSchema).min(1),
    marques: z.array(z.string()),
    horaires: z.string(), // format libre, ex. "Lun-Sam 9h-18h · Dim fermé"
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
    type: z.enum(["peche", "chasse"]).optional(),
    specialite: SpecialiteSchema.optional(),
    province: ProvinceSchema.optional(),
    partenaireOnly: z.boolean().optional(),
});
export type MagasinsFilter = z.infer<typeof MagasinsFilterSchema>;

export type { Province };