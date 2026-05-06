/**
 * UUIDs de catégories produits référencées côté code.
 *
 * Important : ces UUIDs sont hardcodés en migration (0020 + 0028) pour pouvoir
 * y faire référence depuis l'UI (pré-sélection de catégorie selon le contexte).
 */
export const CATEGORY_IDS = {
    GIFT_CARDS: "00000000-0000-0000-0099-000000000001",
} as const;