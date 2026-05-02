/**
 * Provinces wallonnes (slugs strictement alignés avec lib/schemas/lieu.ts).
 */
export const PROVINCES_BE = [
    { value: "hainaut", label: "Hainaut" },
    { value: "liege", label: "Liège" },
    { value: "namur", label: "Namur" },
    { value: "luxembourg", label: "Luxembourg" },
    { value: "brabant-wallon", label: "Brabant wallon" },
] as const;

/**
 * Régions françaises (top niveau administratif, slugifié).
 * Pour la V1 on liste les régions historiques où la pêche est fédérée,
 * en privilégiant les zones cible (Nord, Île-de-France, etc.).
 */
export const REGIONS_FR = [
    { value: "auvergne-rhone-alpes", label: "Auvergne-Rhône-Alpes" },
    { value: "bourgogne-franche-comte", label: "Bourgogne-Franche-Comté" },
    { value: "bretagne", label: "Bretagne" },
    { value: "centre-val-de-loire", label: "Centre-Val de Loire" },
    { value: "corse", label: "Corse" },
    { value: "grand-est", label: "Grand Est" },
    { value: "hauts-de-france", label: "Hauts-de-France" },
    { value: "ile-de-france", label: "Île-de-France" },
    { value: "normandie", label: "Normandie" },
    { value: "nouvelle-aquitaine", label: "Nouvelle-Aquitaine" },
    { value: "occitanie", label: "Occitanie" },
    { value: "pays-de-la-loire", label: "Pays de la Loire" },
    { value: "provence-alpes-cote-azur", label: "Provence-Alpes-Côte d'Azur" },
] as const;

export const COUNTRIES = [
    { value: "BE", label: "Belgique" },
    { value: "FR", label: "France" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["value"];

/**
 * Retourne la liste des régions selon le pays.
 */
export function getRegionsForCountry(country: CountryCode | null | undefined) {
    if (country === "FR") return REGIONS_FR;
    return PROVINCES_BE;
}