export const ESPECES = [
    { value: "carpe",      label: "Carpe" },
    { value: "carnassier", label: "Carnassier" },
    { value: "silure",     label: "Silure" },
    { value: "brochet",    label: "Brochet" },
    { value: "sandre",     label: "Sandre" },
    { value: "perche",     label: "Perche" },
    { value: "truite",     label: "Truite" },
    { value: "black_bass", label: "Black bass" },
    { value: "gardon",     label: "Gardon" },
    { value: "tanche",     label: "Tanche" },
    { value: "esturgeon",  label: "Esturgeon" },
    { value: "salmonide",  label: "Salmonidé" },
    { value: "blanc",      label: "Poisson blanc" },
] as const;

export type EspeceValue = (typeof ESPECES)[number]["value"];

export const ESPECE_LABEL: Record<EspeceValue, string> = Object.fromEntries(
    ESPECES.map((e) => [e.value, e.label])
) as Record<EspeceValue, string>;

export const ESPECE_VALUES = ESPECES.map((e) => e.value) as [
    EspeceValue,
    ...EspeceValue[]
];