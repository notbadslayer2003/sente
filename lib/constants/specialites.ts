/**
 * Spécialités magasin (texte libre côté DB, on propose une liste cohérente).
 */
export const SPECIALITES_MAGASIN = [
    { value: "carpe", label: "Carpe" },
    { value: "carnassier", label: "Carnassier" },
    { value: "silure", label: "Silure" },
    { value: "truite", label: "Truite / mouche" },
    { value: "feeder", label: "Feeder / coup" },
    { value: "mer", label: "Pêche en mer" },
    { value: "general", label: "Généraliste" },
    { value: "occasion", label: "Occasion" },
] as const;

export type SpecialiteValue = (typeof SPECIALITES_MAGASIN)[number]["value"];