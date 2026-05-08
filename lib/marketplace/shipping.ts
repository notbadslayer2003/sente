// =============================================================================
// Shipping marketplace
// =============================================================================
// Tarifs hardcoded pour MVP. À l'étape 8, ces tarifs seront ajustés en temps
// réel via les API Mondial Relay et Colissimo au moment de la génération
// d'étiquette. Pour l'instant on utilise une grille forfaitaire de preview.
//
// Tous les tarifs sont en cents.
// =============================================================================

export type ShippingCarrier = "mondial_relay" | "colissimo";

export type ShippingOption = {
    carrier: ShippingCarrier;
    label: string;
    description: string;
    price_cents: number;
    requires_pickup_point: boolean; // MR demande un point relais, Colissimo non
};

const MAX_WEIGHT_GRAMS = 30_000;

// Tranches de poids → tarif (en cents)
type RateBracket = { max_grams: number; mr_cents: number; colissimo_cents: number };

const BRACKETS: RateBracket[] = [
    { max_grams: 500, mr_cents: 430, colissimo_cents: 580 },
    { max_grams: 2_000, mr_cents: 490, colissimo_cents: 780 },
    { max_grams: 5_000, mr_cents: 690, colissimo_cents: 1130 },
    { max_grams: 10_000, mr_cents: 890, colissimo_cents: 1480 },
    { max_grams: 30_000, mr_cents: 1490, colissimo_cents: 2280 },
];

function findBracket(weightGrams: number): RateBracket | null {
    if (weightGrams <= 0 || weightGrams > MAX_WEIGHT_GRAMS) return null;
    return BRACKETS.find((b) => weightGrams <= b.max_grams) ?? null;
}

/**
 * Tarif pour un carrier donné selon le poids.
 * Retourne null si poids hors range (>30kg).
 */
export function getShippingRate(
    carrier: ShippingCarrier,
    weightGrams: number
): number | null {
    const bracket = findBracket(weightGrams);
    if (!bracket) return null;
    return carrier === "mondial_relay"
        ? bracket.mr_cents
        : bracket.colissimo_cents;
}

/**
 * Liste les options dispo pour un poids donné.
 * Retourne tableau vide si poids invalide.
 */
export function getShippingOptions(weightGrams: number): ShippingOption[] {
    const bracket = findBracket(weightGrams);
    if (!bracket) return [];

    return [
        {
            carrier: "mondial_relay",
            label: "Mondial Relay (point relais)",
            description: "Livraison en point relais sous 3-5 jours ouvrés",
            price_cents: bracket.mr_cents,
            requires_pickup_point: true,
        },
        {
            carrier: "colissimo",
            label: "Colissimo (à domicile)",
            description: "Livraison à domicile sous 2-4 jours ouvrés",
            price_cents: bracket.colissimo_cents,
            requires_pickup_point: false,
        },
    ];
}

export function isShippableWeight(weightGrams: number): boolean {
    return weightGrams > 0 && weightGrams <= MAX_WEIGHT_GRAMS;
}