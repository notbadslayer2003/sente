"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// =============================================================================
// Server Actions : offres marketplace
// =============================================================================
// Note : la table marketplace_offers N'A PAS de colonne thread_id.
// Le lien thread se fait via le couple (listing_id, buyer_user_id) qui matche
// la UNIQUE constraint des threads. responded_at est utilisé pour accept ET
// reject (le status indique lequel).
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const RESERVATION_HOURS = 48;

const makeOfferSchema = z.object({
    threadId: z.string().uuid(),
    amountCents: z.number().int().min(100).max(1_000_000),
});

const offerIdSchema = z.object({
    offerId: z.string().uuid(),
});

const startThreadOfferSchema = z.object({
    listingId: z.string().uuid(),
    amountCents: z.number().int().min(100).max(1_000_000),
});

async function requireUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("UNAUTHENTICATED");
    return { supabase, user };
}

/**
 * Trouve l'id du thread associé à une offre via (listing_id, buyer_user_id).
 * Utilisé pour les revalidatePath.
 */
async function findThreadIdForOffer(
    supabase: Awaited<ReturnType<typeof createClient>>,
    listingId: string,
    buyerUserId: string
): Promise<string | null> {
    const { data } = await supabase
        .from("marketplace_threads")
        .select("id")
        .eq("listing_id", listingId)
        .eq("buyer_user_id", buyerUserId)
        .maybeSingle();
    return data?.id ?? null;
}

// =============================================================================
// Action : makeOffer (buyer fait une nouvelle offre dans un thread)
// =============================================================================

export async function makeOffer(input: {
    threadId: string;
    amountCents: number;
}): Promise<ActionResult<{ offer_id: string }>> {
    const parsed = makeOfferSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();

    const { data: thread } = await supabase
        .from("marketplace_threads")
        .select(`
      id, listing_id, buyer_user_id, seller_user_id,
      listing:marketplace_listings!listing_id(id, status, deleted_at, price_cents)
    `)
        .eq("id", parsed.data.threadId)
        .maybeSingle();

    if (!thread) {
        return { ok: false, error: { code: "THREAD_NOT_FOUND", message: "Conversation introuvable" } };
    }
    if (thread.buyer_user_id !== user.id) {
        return {
            ok: false,
            error: { code: "FORBIDDEN", message: "Seul l'acheteur peut faire une offre" },
        };
    }

    const listing = Array.isArray(thread.listing) ? thread.listing[0] : thread.listing;
    if (!listing || listing.deleted_at !== null) {
        return { ok: false, error: { code: "LISTING_NOT_FOUND", message: "Annonce introuvable" } };
    }
    if (listing.status !== "active") {
        return {
            ok: false,
            error: {
                code: "LISTING_UNAVAILABLE",
                message: "Cette annonce n'est plus disponible pour les offres",
            },
        };
    }
    if (parsed.data.amountCents > listing.price_cents) {
        return {
            ok: false,
            error: {
                code: "OFFER_TOO_HIGH",
                message: "L'offre ne peut pas dépasser le prix demandé",
            },
        };
    }

    // INSERT sans thread_id (la colonne n'existe pas).
    // Triggers DB : max 3 pending + no self-offer.
    const { data: offer, error } = await supabase
        .from("marketplace_offers")
        .insert({
            buyer_user_id: user.id,
            listing_id: thread.listing_id,
            amount_cents: parsed.data.amountCents,
            status: "pending",
        })
        .select("id")
        .single();

    if (error) {
        return { ok: false, error: { code: "DB_INSERT_FAILED", message: error.message } };
    }

    revalidatePath(`/profil/marketplace/messages/${thread.id}`);
    return { ok: true, data: { offer_id: offer.id } };
}

// =============================================================================
// Action : acceptOffer
// =============================================================================
// /!\ Pas atomique (cf. note : promouvoir en RPC SQL plus tard).
// =============================================================================

export async function acceptOffer(input: {
    offerId: string;
}): Promise<ActionResult> {
    const parsed = offerIdSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();

    const { data: offer } = await supabase
        .from("marketplace_offers")
        .select(`
      id, buyer_user_id, listing_id, amount_cents, status,
      listing:marketplace_listings!listing_id(id, seller_user_id, status, deleted_at)
    `)
        .eq("id", parsed.data.offerId)
        .maybeSingle();

    if (!offer) {
        return { ok: false, error: { code: "OFFER_NOT_FOUND", message: "Offre introuvable" } };
    }

    const listing = Array.isArray(offer.listing) ? offer.listing[0] : offer.listing;
    if (!listing) {
        return { ok: false, error: { code: "LISTING_NOT_FOUND", message: "Annonce introuvable" } };
    }
    if (listing.seller_user_id !== user.id) {
        return {
            ok: false,
            error: { code: "FORBIDDEN", message: "Seul le vendeur peut accepter l'offre" },
        };
    }
    if (offer.status !== "pending") {
        return {
            ok: false,
            error: {
                code: "INVALID_STATUS",
                message: `Offre en status '${offer.status}', acceptation impossible`,
            },
        };
    }
    if (listing.status !== "active" || listing.deleted_at !== null) {
        return {
            ok: false,
            error: {
                code: "LISTING_UNAVAILABLE",
                message: "Annonce non active, impossible d'accepter l'offre",
            },
        };
    }

    const admin = createAdminClient();
    const now = new Date();
    const reservedUntil = new Date(now.getTime() + RESERVATION_HOURS * 60 * 60 * 1000);

    // 1. Accept l'offre
    const { error: acceptErr } = await admin
        .from("marketplace_offers")
        .update({
            status: "accepted",
            responded_at: now.toISOString(),
        })
        .eq("id", offer.id);

    if (acceptErr) {
        return { ok: false, error: { code: "DB_UPDATE_FAILED", message: acceptErr.message } };
    }

    // 2. Verrouille le listing en reserved
    const { error: lockErr } = await admin
        .from("marketplace_listings")
        .update({
            status: "reserved",
            reserved_until: reservedUntil.toISOString(),
            reserved_by_user_id: offer.buyer_user_id,
        })
        .eq("id", listing.id);

    if (lockErr) {
        return { ok: false, error: { code: "DB_UPDATE_FAILED", message: lockErr.message } };
    }

    // 3. Expire les autres pending offers de ce listing (superseded)
    const { error: expireErr } = await admin
        .from("marketplace_offers")
        .update({ status: "expired" })
        .eq("listing_id", listing.id)
        .eq("status", "pending")
        .neq("id", offer.id);

    if (expireErr) {
        console.error("[acceptOffer] Failed to expire other pending offers:", expireErr);
    }

    const threadId = await findThreadIdForOffer(supabase, offer.listing_id, offer.buyer_user_id);
    if (threadId) revalidatePath(`/profil/marketplace/messages/${threadId}`);
    revalidatePath("/profil/marketplace/annonces");

    return { ok: true, data: undefined };
}

// =============================================================================
// Action : rejectOffer
// =============================================================================

export async function rejectOffer(input: {
    offerId: string;
}): Promise<ActionResult> {
    const parsed = offerIdSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();

    const { data: offer } = await supabase
        .from("marketplace_offers")
        .select(`
      id, listing_id, buyer_user_id, status,
      listing:marketplace_listings!listing_id(seller_user_id)
    `)
        .eq("id", parsed.data.offerId)
        .maybeSingle();

    if (!offer) {
        return { ok: false, error: { code: "OFFER_NOT_FOUND", message: "Offre introuvable" } };
    }
    const listing = Array.isArray(offer.listing) ? offer.listing[0] : offer.listing;
    if (!listing || listing.seller_user_id !== user.id) {
        return {
            ok: false,
            error: { code: "FORBIDDEN", message: "Seul le vendeur peut refuser l'offre" },
        };
    }
    if (offer.status !== "pending") {
        return {
            ok: false,
            error: { code: "INVALID_STATUS", message: `Offre en status '${offer.status}'` },
        };
    }

    const { error } = await supabase
        .from("marketplace_offers")
        .update({
            status: "rejected",
            responded_at: new Date().toISOString(),
        })
        .eq("id", offer.id);

    if (error) {
        return { ok: false, error: { code: "DB_UPDATE_FAILED", message: error.message } };
    }

    const threadId = await findThreadIdForOffer(supabase, offer.listing_id, offer.buyer_user_id);
    if (threadId) revalidatePath(`/profil/marketplace/messages/${threadId}`);

    return { ok: true, data: undefined };
}

// =============================================================================
// Action : withdrawOffer (buyer retire avant réponse seller)
// =============================================================================

export async function withdrawOffer(input: {
    offerId: string;
}): Promise<ActionResult> {
    const parsed = offerIdSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();

    const { data: offer } = await supabase
        .from("marketplace_offers")
        .select("id, listing_id, buyer_user_id, status")
        .eq("id", parsed.data.offerId)
        .maybeSingle();

    if (!offer) {
        return { ok: false, error: { code: "OFFER_NOT_FOUND", message: "Offre introuvable" } };
    }
    if (offer.buyer_user_id !== user.id) {
        return {
            ok: false,
            error: { code: "FORBIDDEN", message: "Seul l'acheteur peut retirer l'offre" },
        };
    }
    if (offer.status !== "pending") {
        return {
            ok: false,
            error: { code: "INVALID_STATUS", message: "Cette offre n'est plus en attente" },
        };
    }

    const { error } = await supabase
        .from("marketplace_offers")
        .update({ status: "withdrawn" })
        .eq("id", offer.id);

    if (error) {
        return { ok: false, error: { code: "DB_UPDATE_FAILED", message: error.message } };
    }

    const threadId = await findThreadIdForOffer(supabase, offer.listing_id, offer.buyer_user_id);
    if (threadId) revalidatePath(`/profil/marketplace/messages/${threadId}`);

    return { ok: true, data: undefined };
}

// =============================================================================
// Action : startThreadWithOffer
// =============================================================================

export async function startThreadWithOffer(input: {
    listingId: string;
    amountCents: number;
}): Promise<ActionResult<{ thread_id: string; offer_id: string }>> {
    const parsed = startThreadOfferSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();

    const { data: listing } = await supabase
        .from("marketplace_listings")
        .select("id, seller_user_id, status, deleted_at, price_cents")
        .eq("id", parsed.data.listingId)
        .maybeSingle();

    if (!listing || listing.deleted_at !== null) {
        return { ok: false, error: { code: "LISTING_NOT_FOUND", message: "Annonce introuvable" } };
    }
    if (listing.status !== "active") {
        return {
            ok: false,
            error: { code: "LISTING_UNAVAILABLE", message: "Annonce non disponible" },
        };
    }
    if (listing.seller_user_id === user.id) {
        return {
            ok: false,
            error: { code: "SELF_THREAD", message: "Tu ne peux pas faire offre sur ton listing" },
        };
    }
    if (parsed.data.amountCents > listing.price_cents) {
        return {
            ok: false,
            error: {
                code: "OFFER_TOO_HIGH",
                message: "L'offre ne peut pas dépasser le prix demandé",
            },
        };
    }

    // Trouve ou crée le thread
    const { data: existing } = await supabase
        .from("marketplace_threads")
        .select("id")
        .eq("listing_id", parsed.data.listingId)
        .eq("buyer_user_id", user.id)
        .maybeSingle();

    let threadId = existing?.id;
    if (!threadId) {
        const { data: created, error: createErr } = await supabase
            .from("marketplace_threads")
            .insert({
                listing_id: parsed.data.listingId,
                buyer_user_id: user.id,
                seller_user_id: listing.seller_user_id,
            })
            .select("id")
            .single();
        if (createErr || !created) {
            return {
                ok: false,
                error: {
                    code: "DB_INSERT_FAILED",
                    message: createErr?.message ?? "Création thread impossible",
                },
            };
        }
        threadId = created.id;
    }

    // Insert offer (sans thread_id)
    const { data: offer, error: offerErr } = await supabase
        .from("marketplace_offers")
        .insert({
            buyer_user_id: user.id,
            listing_id: parsed.data.listingId,
            amount_cents: parsed.data.amountCents,
            status: "pending",
        })
        .select("id")
        .single();

    if (offerErr || !offer) {
        return {
            ok: false,
            error: { code: "DB_INSERT_FAILED", message: offerErr?.message ?? "Offre échouée" },
        };
    }

    revalidatePath("/profil/marketplace/messages");
    revalidatePath(`/profil/marketplace/messages/${threadId}`);

    return {
        ok: true,
        data: { thread_id: threadId, offer_id: offer.id },
    };
}