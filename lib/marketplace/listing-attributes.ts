import { z } from "zod";

// =============================================================================
// Schémas d'attributs spécifiques pêche par famille de catégorie (N1)
// =============================================================================
// Stockés dans marketplace_listings.attributes (JSONB).
// Validés côté Server Action avant INSERT/UPDATE.
// Champs tous optionnels : un vendeur n'est pas obligé de tout remplir.
// =============================================================================

const cannesAttributesSchema = z
    .object({
        longueur_m: z.number().min(0.3).max(15).optional(),
        // Puissance — soit en lbs (carpe), soit en grammes (lancer/spinning)
        puissance_lbs: z.number().min(0).max(20).optional(),
        puissance_g: z.string().max(20).optional(), // ex: "20-80g", "10-30g"
        action: z.enum(["regular", "medium", "fast", "extra-fast"]).optional(),
        nb_brins: z.number().int().min(1).max(10).optional(),
    })
    .strict();

const moulinetsAttributesSchema = z
    .object({
        taille: z.number().int().min(500).max(20000).optional(), // 1000, 2500, 4000, 6000...
        lateralite: z.enum(["gaucher", "droitier", "ambidextre"]).optional(),
        ratio: z.string().max(10).optional(), // ex: "5.2:1"
        type_frein: z.enum(["avant", "arriere", "combat", "free-spool"]).optional(),
    })
    .strict();

const lignesAttributesSchema = z
    .object({
        type: z.enum(["nylon", "tresse", "fluorocarbone", "monofilament"]).optional(),
        diametre_mm: z.number().min(0.05).max(2).optional(),
        resistance_kg: z.number().min(0.1).max(200).optional(),
        longueur_m: z.number().int().min(50).max(5000).optional(),
        couleur: z.string().max(30).optional(),
    })
    .strict();

const hameconsAttributesSchema = z
    .object({
        taille: z.string().max(10).optional(), // ex: "n°10", "1/0"
        type: z.enum(["simple", "triple", "double", "cercle"]).optional(),
        avec_ardillon: z.boolean().optional(),
    })
    .strict();

const leurresAttributesSchema = z
    .object({
        type: z.enum([
            "souple",
            "dur-flottant",
            "dur-coulant",
            "dur-suspending",
            "cuiller",
            "spinnerbait",
            "buzzbait",
            "mouche",
            "streamer",
        ]).optional(),
        poids_g: z.number().min(0.1).max(500).optional(),
        longueur_cm: z.number().min(0.5).max(50).optional(),
        couleur_dominante: z.string().max(50).optional(),
    })
    .strict();

const detectionAttributesSchema = z
    .object({
        nb_detecteurs: z.number().int().min(1).max(8).optional(),
        sans_fil: z.boolean().optional(),
        type_sondeur: z.enum(["couleur", "noir-blanc", "imagerie", "down-imaging", "side-imaging"]).optional(),
        portee_m: z.number().min(0).max(2000).optional(),
    })
    .strict();

const bivouacAttributesSchema = z
    .object({
        nb_places: z.number().int().min(1).max(4).optional(),
        hivernale: z.boolean().optional(),
        poids_kg: z.number().min(0.1).max(50).optional(),
    })
    .strict();

const amorcesAttributesSchema = z
    .object({
        type: z.enum(["amorce-seche", "graines", "bouillettes", "pellets", "billes-flottantes"]).optional(),
        poids_kg: z.number().min(0.1).max(100).optional(),
    })
    .strict();

const defaultAttributesSchema = z.object({}).passthrough();

// =============================================================================
// Mapping famille (N1 slug) → schéma
// =============================================================================
const SCHEMAS_BY_FAMILY: Record<string, z.ZodSchema> = {
    cannes: cannesAttributesSchema,
    moulinets: moulinetsAttributesSchema,
    "lignes-bas-de-ligne": lignesAttributesSchema,
    "hamecons-terminal-tackle": hameconsAttributesSchema,
    leurres: leurresAttributesSchema,
    detection: detectionAttributesSchema,
    "bivouac-confort": bivouacAttributesSchema,
    "amorces-graines": amorcesAttributesSchema,
};

/**
 * Récupère le schéma Zod approprié pour valider les attributs d'un listing.
 * On regarde d'abord la famille (N1) par le slug parent. Si la catégorie est
 * elle-même un N1, son slug est utilisé directement. Catégories sans schéma
 * spécifique (bagagerie, vêtements, divers, etc.) tombent sur le default
 * permissif.
 */
export function getAttributesSchemaForCategory(opts: {
    categorySlug: string;
    parentSlug: string | null;
}): z.ZodSchema {
    const family = opts.parentSlug ?? opts.categorySlug;
    return SCHEMAS_BY_FAMILY[family] ?? defaultAttributesSchema;
}