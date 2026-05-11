import { findShippingOption, type SendcloudCarrier } from "@/lib/sendcloud/operations";

// =============================================================================
// Shipping marketplace — pricing dynamique via Sendcloud
// =============================================================================
// Le coût d'expédition est désormais résolu en temps réel via l'API Sendcloud.
// Plus de grille hardcodée (qui sous-estimait l'international).
// =============================================================================

export type ShippingCarrier = "mondial_relay" | "bpost";

export type ShippingOption = {
    carrier: ShippingCarrier;
    label: string;
    description: string;
    price_cents: number;
    requires_pickup_point: boolean;
};

const MAX_WEIGHT_GRAMS = 30_000;

export function isShippableWeight(weightGrams: number): boolean {
    return weightGrams > 0 && weightGrams <= MAX_WEIGHT_GRAMS;
}

const CARRIER_SPEC: Record<ShippingCarrier, {
    label: string;
    description: string;
    requiresServicePoint: boolean;
}> = {
    mondial_relay: {
        label: "Mondial Relay (point relais)",
        description: "Livraison en point relais sous 3-5 jours ouvrés",
        requiresServicePoint: true,
    },
    bpost: {
        label: "bpost (à domicile)",
        description: "Livraison à domicile sous 1-2 jours ouvrés",
        requiresServicePoint: false,
    },
};

/**
 * Tarif réel pour un carrier donné, via Sendcloud.
 * Retourne null si pas de method matchant (poids hors range, dest non couverte).
 */
export async function getShippingRate(
    carrier: ShippingCarrier,
    weightGrams: number,
    fromCountry: "BE" | "FR",
    toCountry: "BE" | "FR"
): Promise<number | null> {
    if (!isShippableWeight(weightGrams)) return null;
    try {
        const option = await findShippingOption({
            carrier: carrier as SendcloudCarrier,
            weightGrams,
            fromCountry,
            toCountry,
            requiresServicePoint: CARRIER_SPEC[carrier].requiresServicePoint,
        });
        return option.priceCents;
    } catch {
        return null;
    }
}

/**
 * Liste les options dispo pour un envoi donné, avec leur prix réel Sendcloud.
 * Filtre les options qui n'ont pas de tarif (carrier indispo pour cette destination).
 *
 * À noter : 1 appel Sendcloud par carrier en parallèle. Au MVP c'est OK,
 * à cacher si volume monte (clé : carrier+weight+from+to, TTL 1h).
 */
export async function getShippingOptions(
    weightGrams: number,
    fromCountry: "BE" | "FR",
    toCountry: "BE" | "FR"
): Promise<ShippingOption[]> {
    if (!isShippableWeight(weightGrams)) return [];

    const carriers: ShippingCarrier[] = ["mondial_relay", "bpost"];
    const options = await Promise.all(
        carriers.map(async (carrier): Promise<ShippingOption | null> => {
            const spec = CARRIER_SPEC[carrier];
            const priceCents = await getShippingRate(carrier, weightGrams, fromCountry, toCountry);
            if (priceCents === null) return null;
            return {
                carrier,
                label: spec.label,
                description: spec.description,
                price_cents: priceCents,
                requires_pickup_point: spec.requiresServicePoint,
            };
        })
    );

    return options.filter((o): o is ShippingOption => o !== null);
}