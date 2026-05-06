export const SPECIALITES_MAGASIN = [
    { value: "carpe",      label: "Carpe" },
    { value: "carnassier", label: "Carnassier" },
    { value: "silure",     label: "Silure" },
    { value: "truite",     label: "Truite / mouche" },
    { value: "feeder",     label: "Feeder / coup" },
    { value: "mer",        label: "Pêche en mer" },
    { value: "general",    label: "Généraliste" },
    { value: "occasion",   label: "Occasion" },
    // anciens — conservés pour rétrocompat lecture DB
    { value: "mouche",      label: "Mouche" },
    { value: "peche-blanc", label: "Pêche blanc" },
    { value: "peche-mer",   label: "Pêche mer" },
] as const;

export type SpecialiteValue = (typeof SPECIALITES_MAGASIN)[number]["value"];

export const SPECIALITE_LABEL: Record<SpecialiteValue, string> = Object.fromEntries(
    SPECIALITES_MAGASIN.map((s) => [s.value, s.label])
) as Record<SpecialiteValue, string>;