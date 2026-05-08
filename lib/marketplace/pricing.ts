// =============================================================================
// Pricing marketplace C2C
// =============================================================================
// Modèle :
// - Buyer paie : listing + shipping + frais Stripe (passthrough transparent)
// - Sente garde : 5% du listing + 0,70€ + le shipping (utilisé pour payer
//   l'étiquette carrier)
// - Seller reçoit : listing - sente_commission (transfer après release escrow)
//
// Frais Stripe : 1,5% + 0,25€ sur le total chargé. On résout l'équation
// circulaire pour que le passthrough couvre exactement les frais réels.
//
// Toutes les valeurs sont en cents (entiers).
// =============================================================================

const SENTE_COMMISSION_PCT = 0.05;
const SENTE_COMMISSION_FIXED_CENTS = 70; // 0,70€

const STRIPE_FEE_PCT = 0.015;
const STRIPE_FEE_FIXED_CENTS = 25; // 0,25€

export type PricingBreakdown = {
    listing_price_cents: number;
    shipping_cents: number;
    subtotal_cents: number; // listing + shipping (sans frais Stripe)
    stripe_fee_passthrough_cents: number;
    buyer_pays_cents: number; // total chargé au buyer
    sente_commission_cents: number;
    seller_receives_cents: number; // ce que reçoit le vendeur après commission
};

/**
 * Calcule le détail prix complet pour un order C2C.
 * @param listingPriceCents prix demandé (ou prix d'offre acceptée)
 * @param shippingCents frais shipping selon carrier choisi
 */
export function calculatePricing(
    listingPriceCents: number,
    shippingCents: number
): PricingBreakdown {
    const subtotal = listingPriceCents + shippingCents;

    // Sente : 5% du listing seulement (pas du shipping) + 0,70€ fixe
    const senteCommission = Math.round(
        SENTE_COMMISSION_PCT * listingPriceCents + SENTE_COMMISSION_FIXED_CENTS
    );

    // Frais Stripe passthrough (équation circulaire)
    // x = stripe_fee = pct * (subtotal + x) + fixed
    // x = (pct * subtotal + fixed) / (1 - pct)
    const stripeFeePassthrough = Math.ceil(
        (STRIPE_FEE_PCT * subtotal + STRIPE_FEE_FIXED_CENTS) /
        (1 - STRIPE_FEE_PCT)
    );

    const buyerPays = subtotal + stripeFeePassthrough;
    const sellerReceives = listingPriceCents - senteCommission;

    return {
        listing_price_cents: listingPriceCents,
        shipping_cents: shippingCents,
        subtotal_cents: subtotal,
        stripe_fee_passthrough_cents: stripeFeePassthrough,
        buyer_pays_cents: buyerPays,
        sente_commission_cents: senteCommission,
        seller_receives_cents: sellerReceives,
    };
}

/**
 * Helper d'affichage : convertit cents → string EUR formaté.
 */
export function formatCents(cents: number, locale = "fr-BE"): string {
    return (cents / 100).toLocaleString(locale, {
        style: "currency",
        currency: "EUR",
    });
}