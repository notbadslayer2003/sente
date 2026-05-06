import { z } from "zod";

/**
 * Valide un UUID au format hex 8-4-4-4-12 sans imposer une version RFC 4122
 * spécifique. Utile pour accepter à la fois les UUIDs générés par
 * gen_random_uuid() (v4) et les UUIDs hardcodés en seed (catégories produits).
 *
 * Postgres reste la source de vérité : la FK validera l'existence réelle.
 */
export const zUuid = z
    .string()
    .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        "UUID invalide"
    );