import { z } from "zod";

export const PaysSchema = z.enum(["BE", "FR"]);
export type Pays = z.infer<typeof PaysSchema>;

export const PaysLabel: Record<Pays, string> = {
    BE: "Wallonie",
    FR: "France",
};

import { ESPECES, type EspeceValue } from "@/lib/constants/especes";

const ESPECE_VALUES = ESPECES.map((e) => e.value) as [EspeceValue, ...EspeceValue[]];

export const EspeceSchema = z.enum(ESPECE_VALUES);
export type Espece = EspeceValue;

export { ESPECE_LABEL as EspeceLabel } from "@/lib/constants/especes";

// Reste du fichier inchangé

export const ProvinceSchema = z.enum([
    "hainaut",
    "liege",
    "namur",
    "luxembourg",
    "brabant-wallon",
]);
export type Province = z.infer<typeof ProvinceSchema>;

export const ProvinceLabel: Record<Province, string> = {
    hainaut: "Hainaut",
    liege: "Liège",
    namur: "Namur",
    luxembourg: "Luxembourg",
    "brabant-wallon": "Brabant wallon",
};

export const ReglementSchema = z.object({
    noKill: z.boolean(),
    baitboatAutorise: z.boolean(),
    nuitAutorisee: z.boolean(),
    nbCannesMax: z.number().int().min(1).max(6),
    permisRequis: z.boolean(),
});
export type Reglement = z.infer<typeof ReglementSchema>;

export const TarifSchema = z.object({
    jour: z.number().nonnegative(),
    nuit: z.number().nonnegative().optional(),
    forfait48h: z.number().nonnegative().optional(),
    semaine: z.number().nonnegative().optional(),
});
export type Tarif = z.infer<typeof TarifSchema>;

export const LieuSchema = z.object({
    id: z.string().min(1), // TODO: passer en z.uuid() quand on branche Supabase
    slug: z.string().min(1),
    nom: z.string(),
    description: z.string(),
    pays: PaysSchema.default("BE"),
    province: ProvinceSchema,
    commune: z.string(),
    superficieHa: z.number().positive(),
    profondeurMaxM: z.number().positive().optional(),
    especes: z.array(EspeceSchema).default([]),
    reglement: ReglementSchema,
    tarif: TarifSchema,
    recordKg: z.number().positive().optional(),
    postesCount: z.number().int().nonnegative(),
    photos: z.array(z.string().url()).min(1),
    coordonnees: z.object({ lat: z.number(), lng: z.number() }),
    contact: z.object({
        email: z.string().email().optional(),
        telephone: z.string().optional(),
        siteWeb: z.string().url().optional(),
    }),
    reservable: z.boolean(),
    noteMoyenne: z.number().min(0).max(5).optional(),
    nbAvis: z.number().int().nonnegative(),
});
export type Lieu = z.infer<typeof LieuSchema>;

export const LieuxFilterSchema = z.object({
    pays: PaysSchema.optional(),
    espece: EspeceSchema.optional(),
    province: ProvinceSchema.optional(),
    reservableOnly: z.boolean().optional(),
});
export type LieuxFilter = z.infer<typeof LieuxFilterSchema>;