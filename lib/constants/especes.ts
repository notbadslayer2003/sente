/**
 * Espèces de poisson disponibles dans la DB (alignées avec l'enum espece_poisson).
 * Le label peut être traduit/affiché sans toucher à la valeur slug.
 */
export const ESPECES = [
    { value: "carpe", label: "Carpe" },
    { value: "silure", label: "Silure" },
    { value: "brochet", label: "Brochet" },
    { value: "sandre", label: "Sandre" },
    { value: "perche", label: "Perche" },
    { value: "truite", label: "Truite" },
    { value: "black_bass", label: "Black bass" },
    { value: "gardon", label: "Gardon" },
    { value: "tanche", label: "Tanche" },
    { value: "esturgeon", label: "Esturgeon" },
    { value: "salmonide", label: "Salmonidés" },
    { value: "carnassier", label: "Carnassier (générique)" },
    { value: "blanc", label: "Poisson blanc (générique)" },
] as const;

export type EspeceValue = (typeof ESPECES)[number]["value"];