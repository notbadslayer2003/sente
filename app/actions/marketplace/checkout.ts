"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
    calculatePricing,
    type PricingBreakdown,
} from "@/lib/marketplace/pricing";
import {
    getShippingOptions,
    getShippingRate,
    isShippableWeight,
    type ShippingCarrier,
    type ShippingOption,
} from "@/lib/marketplace/shipping";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
// =============================================================================
// Server Actions : checkout (preview quote uniquement à 7a)
// =============================================================================
// La création réelle d'order + PaymentIntent vient en 7b avec l'UI checkout.
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const quoteFromListingSchema = z.object({
    listingId: z.string().uuid(),
    carrier: z.enum(["mondial_relay", "colissimo"]).optional(),
});

const quoteFromOfferSchema = z.object({
    offerId: z.string().uuid(),
    carrier: z.enum(["mondial_relay", "colissimo"]).optional(),
});

export type CheckoutQuoteData = {
    listing_id: string;
    listing_title: string;
    seller_user_id: string;
    weight_grams: number;
    base_price_cents: number; // prix listing OU prix offre acceptée
    is_from_offer: boolean;
    offer_id: string | null;
    shipping_options: ShippingOption[];
    selected_carrier: ShippingCarrier | null;
    pricing: PricingBreakdown | null; // null si pas encore de carrier choisi
};

// =============================================================================
// Action : getCheckoutQuoteFromListing (achat direct au prix listing)
// =============================================================================

export async function getCheckoutQuoteFromListing(input: {
    listingId: string;
    carrier?: ShippingCarrier;
}): Promise<ActionResult<CheckoutQuoteData>> {
    const parsed = quoteFromListingSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const { data: listing } = await supabase
        .from("marketplace_listings")
        .select("id, title, seller_user_id, status, deleted_at, price_cents, weight_grams")
        .eq("id", parsed.data.listingId)
        .maybeSingle();

    if (!listing || listing.deleted_at !== null) {
        return { ok: false, error: { code: "LISTING_NOT_FOUND", message: "Annonce introuvable" } };
    }
    if (listing.seller_user_id === user.id) {
        return {
            ok: false,
            error: { code: "SELF_PURCHASE", message: "Tu ne peux pas acheter ta propre annonce" },
        };
    }
    if (listing.status !== "active") {
        return {
            ok: false,
            error: { code: "LISTING_UNAVAILABLE", message: "Annonce non disponible à l'achat" },
        };
    }
    if (!isShippableWeight(listing.weight_grams)) {
        return {
            ok: false,
            error: {
                code: "INVALID_WEIGHT",
                message: "Poids hors range expédiable (>30kg)",
            },
        };
    }

    const shippingOptions = getShippingOptions(listing.weight_grams);
    let pricing: PricingBreakdown | null = null;

    if (parsed.data.carrier) {
        const shippingCents = getShippingRate(parsed.data.carrier, listing.weight_grams);
        if (shippingCents !== null) {
            pricing = calculatePricing(listing.price_cents, shippingCents);
        }
    }

    return {
        ok: true,
        data: {
            listing_id: listing.id,
            listing_title: listing.title,
            seller_user_id: listing.seller_user_id,
            weight_grams: listing.weight_grams,
            base_price_cents: listing.price_cents,
            is_from_offer: false,
            offer_id: null,
            shipping_options: shippingOptions,
            selected_carrier: parsed.data.carrier ?? null,
            pricing,
        },
    };
}

// =============================================================================
// Action : getCheckoutQuoteFromOffer (depuis offre acceptée)
// =============================================================================

export async function getCheckoutQuoteFromOffer(input: {
    offerId: string;
    carrier?: ShippingCarrier;
}): Promise<ActionResult<CheckoutQuoteData>> {
    const parsed = quoteFromOfferSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const { data: offer } = await supabase
        .from("marketplace_offers")
        .select(`
      id, buyer_user_id, listing_id, amount_cents, status,
      listing:marketplace_listings!listing_id(
        id, title, seller_user_id, status, deleted_at, weight_grams
      )
    `)
        .eq("id", parsed.data.offerId)
        .maybeSingle();

    if (!offer) {
        return { ok: false, error: { code: "OFFER_NOT_FOUND", message: "Offre introuvable" } };
    }
    if (offer.buyer_user_id !== user.id) {
        return {
            ok: false,
            error: { code: "FORBIDDEN", message: "Tu n'es pas l'acheteur de cette offre" },
        };
    }
    if (offer.status !== "accepted") {
        return {
            ok: false,
            error: {
                code: "OFFER_NOT_ACCEPTED",
                message: "Cette offre n'est pas acceptée par le vendeur",
            },
        };
    }

    const listing = Array.isArray(offer.listing) ? offer.listing[0] : offer.listing;
    if (!listing || listing.deleted_at !== null) {
        return { ok: false, error: { code: "LISTING_NOT_FOUND", message: "Annonce introuvable" } };
    }
    if (listing.status !== "reserved") {
        return {
            ok: false,
            error: {
                code: "LISTING_UNAVAILABLE",
                message: `Annonce en status '${listing.status}', paiement impossible`,
            },
        };
    }
    if (!isShippableWeight(listing.weight_grams)) {
        return {
            ok: false,
            error: { code: "INVALID_WEIGHT", message: "Poids hors range expédiable" },
        };
    }

    const shippingOptions = getShippingOptions(listing.weight_grams);
    let pricing: PricingBreakdown | null = null;

    if (parsed.data.carrier) {
        const shippingCents = getShippingRate(parsed.data.carrier, listing.weight_grams);
        if (shippingCents !== null) {
            pricing = calculatePricing(offer.amount_cents, shippingCents);
        }
    }

    return {
        ok: true,
        data: {
            listing_id: listing.id,
            listing_title: listing.title,
            seller_user_id: listing.seller_user_id,
            weight_grams: listing.weight_grams,
            base_price_cents: offer.amount_cents,
            is_from_offer: true,
            offer_id: offer.id,
            shipping_options: shippingOptions,
            selected_carrier: parsed.data.carrier ?? null,
            pricing,
        },
    };
}

const createCheckoutSchema = z
    .object({
        listingId: z.string().uuid().optional(),
        offerId: z.string().uuid().optional(),
        addressId: z.string().uuid(),
        carrier: z.enum(["mondial_relay", "colissimo"]),
        relayPointId: z.string().max(50).nullable().default(null),
    })
    .refine((d) => Boolean(d.listingId) !== Boolean(d.offerId), {
        message: "Doit fournir listingId OU offerId (pas les deux, pas aucun)",
    });

export type CreateCheckoutResult = {
    order_id: string;
    checkout_url: string;
};

const CARRIER_LABELS: Record<ShippingCarrier, string> = {
    mondial_relay: "Mondial Relay",
    colissimo: "Colissimo",
};

/**
 * Crée un order pending_payment + une Stripe Checkout Session.
 * Idempotent : si un order pending existe avec une session ouverte, on retourne
 * l'URL de cette session.
 *
 * Retourne l'URL `checkout.stripe.com` à laquelle rediriger le buyer.
 */
export async function createOrderAndCheckoutSession(input: {
    listingId?: string;
    offerId?: string;
    addressId: string;
    carrier: ShippingCarrier;
    relayPointId?: string | null;
}): Promise<ActionResult<CreateCheckoutResult>> {
    const parsed = createCheckoutSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    // --- 1. Charge l'adresse (ownership check)
    const { data: address } = await supabase
        .from("marketplace_addresses")
        .select("*")
        .eq("id", parsed.data.addressId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (!address) {
        return { ok: false, error: { code: "ADDRESS_NOT_FOUND", message: "Adresse introuvable" } };
    }

    // --- 2. Charge listing/offer selon contexte
    let listingId: string;
    let listingTitle: string;
    let basePriceCents: number;
    let offerId: string | null = null;

    if (parsed.data.offerId) {
        const { data: offer } = await supabase
            .from("marketplace_offers")
            .select(`
        id, buyer_user_id, listing_id, amount_cents, status,
        listing:marketplace_listings!listing_id(
          id, title, seller_user_id, status, deleted_at, weight_grams, price_cents
        )
      `)
            .eq("id", parsed.data.offerId)
            .maybeSingle();

        if (!offer) {
            return { ok: false, error: { code: "OFFER_NOT_FOUND", message: "Offre introuvable" } };
        }
        if (offer.buyer_user_id !== user.id) {
            return { ok: false, error: { code: "FORBIDDEN", message: "Pas votre offre" } };
        }
        if (offer.status !== "accepted") {
            return {
                ok: false,
                error: { code: "OFFER_NOT_ACCEPTED", message: "Offre non acceptée" },
            };
        }

        const lst = Array.isArray(offer.listing) ? offer.listing[0] : offer.listing;
        if (!lst || lst.deleted_at !== null) {
            return { ok: false, error: { code: "LISTING_NOT_FOUND", message: "Annonce introuvable" } };
        }
        if (lst.status !== "reserved") {
            return {
                ok: false,
                error: { code: "LISTING_UNAVAILABLE", message: "Annonce non réservée" },
            };
        }

        listingId = lst.id;
        listingTitle = lst.title;
        basePriceCents = offer.amount_cents;
        offerId = offer.id;
    } else if (parsed.data.listingId) {
        const { data: lst } = await supabase
            .from("marketplace_listings")
            .select("id, title, seller_user_id, status, deleted_at, weight_grams, price_cents")
            .eq("id", parsed.data.listingId)
            .maybeSingle();

        if (!lst || lst.deleted_at !== null) {
            return { ok: false, error: { code: "LISTING_NOT_FOUND", message: "Annonce introuvable" } };
        }
        if (lst.seller_user_id === user.id) {
            return { ok: false, error: { code: "SELF_PURCHASE", message: "Pas votre annonce" } };
        }
        if (lst.status !== "active") {
            return {
                ok: false,
                error: { code: "LISTING_UNAVAILABLE", message: "Annonce non disponible" },
            };
        }

        listingId = lst.id;
        listingTitle = lst.title;
        basePriceCents = lst.price_cents;
    } else {
        return { ok: false, error: { code: "INVALID_INPUT", message: "listingId ou offerId requis" } };
    }

    // --- 3. Récup weight + seller_user_id (un seul fetch homogène)
    const { data: listingFull } = await supabase
        .from("marketplace_listings")
        .select("id, seller_user_id, weight_grams")
        .eq("id", listingId)
        .single();

    if (!listingFull) {
        return { ok: false, error: { code: "LISTING_NOT_FOUND", message: "Annonce introuvable" } };
    }
    if (!isShippableWeight(listingFull.weight_grams)) {
        return { ok: false, error: { code: "INVALID_WEIGHT", message: "Poids hors range" } };
    }

    // --- 4. Tarif shipping
    const shippingCents = getShippingRate(parsed.data.carrier, listingFull.weight_grams);
    if (shippingCents === null) {
        return { ok: false, error: { code: "INVALID_CARRIER", message: "Tarif introuvable" } };
    }

    if (parsed.data.carrier === "mondial_relay" && !parsed.data.relayPointId) {
        return {
            ok: false,
            error: { code: "MISSING_RELAY", message: "Point relais Mondial Relay requis" },
        };
    }

    // --- 5. Eligibilité seller (lu via admin client, RLS bloque les non-owners)
    //
    // Archi escrow Sente : le buyer paie le compte plateforme. Donc on n'a
    // PAS besoin de stripe_charges_enabled (concerne la capacité du seller
    // à encaisser sur SON compte, ce qu'on ne fait pas ici).
    //
    // stripe_payouts_enabled non bloquant au checkout : Stripe peut mettre
    // plusieurs jours à activer payouts après onboarding, on rebloque au
    // release T+48h (étape 10) si nécessaire.
    //
    // Pourquoi admin client ici : la table marketplace_seller_accounts contient
    // des champs DAC7 sensibles, sa RLS SELECT n'autorise que le user lui-même.
    // On lit en service_role pour ce check de service côté serveur — aucune
    // donnée seller n'est renvoyée au client, on retourne juste un bool effectif.
    const adminEligibility = createAdminClient();
    const { data: sellerAccount } = await adminEligibility
        .from("marketplace_seller_accounts")
        .select("kyc_status, stripe_account_id")
        .eq("user_id", listingFull.seller_user_id)
        .maybeSingle();

    if (
        !sellerAccount ||
        sellerAccount.kyc_status !== "verified" ||
        !sellerAccount.stripe_account_id
    ) {
        return {
            ok: false,
            error: {
                code: "SELLER_NOT_READY",
                message: "Le vendeur n'est pas en état de recevoir des paiements",
            },
        };
    }

    // --- 6. Pricing
    const pricing = calculatePricing(basePriceCents, shippingCents);
    const admin = createAdminClient();
    const stripe = getStripeClient();

    // --- 7. Idempotence : order pending_payment existant ?
    const { data: existing } = await admin
        .from("marketplace_orders")
        .select("id, stripe_checkout_session_id")
        .eq("buyer_user_id", user.id)
        .eq("listing_id", listingId)
        .eq("status", "pending_payment")
        .maybeSingle();

    if (existing && existing.stripe_checkout_session_id) {
        try {
            const session = await stripe.checkout.sessions.retrieve(
                existing.stripe_checkout_session_id
            );
            if (session.status === "open" && session.url) {
                return {
                    ok: true,
                    data: { order_id: existing.id, checkout_url: session.url },
                };
            }
        } catch {
            // Session expirée ou supprimée → on continue et on en crée une nouvelle
        }
    }

    // --- 8. INSERT order pending_payment (ou réutilise si existait sans session valide)
    let orderId: string;
    if (existing) {
        orderId = existing.id;
    } else {
        const { data: order, error: orderErr } = await admin
            .from("marketplace_orders")
            .insert({
                listing_id: listingId,
                offer_id: offerId,
                buyer_user_id: user.id,
                seller_user_id: listingFull.seller_user_id,
                item_price_cents: pricing.listing_price_cents,
                shipping_cents: pricing.shipping_cents,
                commission_cents: pricing.sente_commission_cents,
                stripe_fees_cents: pricing.stripe_fee_passthrough_cents,
                total_cents: pricing.buyer_pays_cents,
                seller_payout_cents: pricing.seller_receives_cents,
                currency: "EUR",
                status: "pending_payment",
                shipping_carrier: parsed.data.carrier,
                relay_point_id: parsed.data.relayPointId,
                shipping_full_name: address.full_name,
                shipping_line1: address.line1,
                shipping_line2: address.line2,
                shipping_postal_code: address.postal_code,
                shipping_city: address.city,
                shipping_country: address.country,
                shipping_phone: address.phone,
                refunded_amount_cents: 0,
            })
            .select("id")
            .single();

        if (orderErr || !order) {
            return {
                ok: false,
                error: {
                    code: "DB_INSERT_FAILED",
                    message: orderErr?.message ?? "Création order impossible",
                },
            };
        }
        orderId = order.id;
    }

    // --- 9. Checkout Session
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
    const cancelPath = parsed.data.offerId
        ? `/profil/marketplace/checkout/offre/${parsed.data.offerId}`
        : `/profil/marketplace/checkout/annonce/${parsed.data.listingId}`;
    const carrierLabel = CARRIER_LABELS[parsed.data.carrier];

    let session;
    try {
        session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "eur",
                        product_data: { name: listingTitle },
                        unit_amount: pricing.listing_price_cents,
                    },
                    quantity: 1,
                },
                {
                    price_data: {
                        currency: "eur",
                        product_data: { name: `Livraison ${carrierLabel}` },
                        unit_amount: pricing.shipping_cents,
                    },
                    quantity: 1,
                },
                {
                    price_data: {
                        currency: "eur",
                        product_data: { name: "Frais de service" },
                        unit_amount: pricing.stripe_fee_passthrough_cents,
                    },
                    quantity: 1,
                },
            ],
            success_url: `${baseUrl}/profil/marketplace/commandes/${orderId}?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}${cancelPath}`,
            metadata: {
                sente_context: "marketplace_c2c",
                order_id: orderId,
            },
            payment_intent_data: {
                metadata: {
                    sente_context: "marketplace_c2c",
                    order_id: orderId,
                    listing_id: listingId,
                    offer_id: offerId ?? "",
                    seller_stripe_account_id: sellerAccount.stripe_account_id,
                    buyer_user_id: user.id,
                    seller_user_id: listingFull.seller_user_id,
                },
            },
        });
    } catch (err) {
        // Si on a créé un order frais et que la session échoue, on rollback
        if (!existing) {
            await admin.from("marketplace_orders").delete().eq("id", orderId);
        }
        return {
            ok: false,
            error: {
                code: "STRIPE_FAILED",
                message: err instanceof Error ? err.message : "Création session refusée",
            },
        };
    }

    if (!session.url) {
        return { ok: false, error: { code: "STRIPE_NO_URL", message: "URL Stripe manquante" } };
    }

    await admin
        .from("marketplace_orders")
        .update({ stripe_checkout_session_id: session.id })
        .eq("id", orderId);

    return {
        ok: true,
        data: { order_id: orderId, checkout_url: session.url },
    };
}