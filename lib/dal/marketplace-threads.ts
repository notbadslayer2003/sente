import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// =============================================================================
// DAL : marketplace_threads
// =============================================================================
// Note importante : marketplace_offers N'A PAS de colonne thread_id.
// Les offres sont liées au thread par le couple (listing_id, buyer_user_id).
// Du coup on charge les offres séparément après le thread.
// =============================================================================

export type MarketplaceMessage = {
    id: string;
    thread_id: string;
    sender_user_id: string;
    body: string;
    filtered_flags: { emails?: string[]; phones?: string[] } | null;
    read_at: string | null;
    created_at: string;
};

export type MarketplaceOffer = {
    id: string;
    buyer_user_id: string;
    listing_id: string;
    amount_cents: number;
    status: Database["public"]["Enums"]["marketplace_offer_status"];
    responded_at: string | null;
    expires_at: string | null;
    parent_offer_id: string | null;
    created_at: string;
};

export type MarketplaceThreadSummary = {
    id: string;
    listing_id: string;
    buyer_user_id: string;
    seller_user_id: string;
    last_message_at: string;
    created_at: string;
    listing: {
        id: string;
        title: string;
        price_cents: number;
        status: string;
        photos: { storage_path: string; position: number }[];
    } | null;
    buyer: { id: string; full_name: string | null; avatar_url: string | null } | null;
    seller: { id: string; full_name: string | null; avatar_url: string | null } | null;
    last_message: { body: string; sender_user_id: string } | null;
};

export type MarketplaceThreadFull = MarketplaceThreadSummary & {
    messages: MarketplaceMessage[];
    offers: MarketplaceOffer[];
};

/**
 * Liste tous les threads où le user est buyer OU seller.
 * Triés par last_message_at DESC (plus récents en haut).
 */
export async function getMyThreads(): Promise<MarketplaceThreadSummary[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from("marketplace_threads")
        .select(`
      id, listing_id, buyer_user_id, seller_user_id, last_message_at, created_at,
      listing:marketplace_listings!listing_id(
        id, title, price_cents, status,
        photos:marketplace_listing_photos(storage_path, position)
      ),
      buyer:profiles!buyer_user_id(id, full_name, avatar_url),
      seller:profiles!seller_user_id(id, full_name, avatar_url)
    `)
        .or(`buyer_user_id.eq.${user.id},seller_user_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

    if (error) throw error;

    const threads = (data ?? []) as unknown as MarketplaceThreadSummary[];
    if (threads.length === 0) return [];

    // Fetch dernier message de chaque thread (Supabase ne supporte pas LATERAL)
    const threadIds = threads.map((t) => t.id);
    const { data: lastMessages } = await supabase
        .from("marketplace_messages")
        .select("thread_id, body, sender_user_id, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false });

    const lastMessageByThread = new Map<
        string,
        { body: string; sender_user_id: string }
    >();
    for (const m of lastMessages ?? []) {
        if (!lastMessageByThread.has(m.thread_id)) {
            lastMessageByThread.set(m.thread_id, {
                body: m.body,
                sender_user_id: m.sender_user_id,
            });
        }
    }

    return threads.map((t) => ({
        ...t,
        listing: t.listing
            ? {
                ...t.listing,
                photos: [...t.listing.photos].sort((a, b) => a.position - b.position),
            }
            : null,
        last_message: lastMessageByThread.get(t.id) ?? null,
    }));
}

/**
 * Charge un thread complet (messages + offres) si le user est participant.
 * Les offres sont chargées via (listing_id, buyer_user_id) car la table
 * marketplace_offers n'a pas de FK thread_id.
 */
export async function getThread(
    threadId: string
): Promise<MarketplaceThreadFull | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Thread + listing + profiles + messages
    const { data, error } = await supabase
        .from("marketplace_threads")
        .select(`
      id, listing_id, buyer_user_id, seller_user_id, last_message_at, created_at,
      listing:marketplace_listings!listing_id(
        id, title, price_cents, status,
        photos:marketplace_listing_photos(storage_path, position)
      ),
      buyer:profiles!buyer_user_id(id, full_name, avatar_url),
      seller:profiles!seller_user_id(id, full_name, avatar_url),
      messages:marketplace_messages(
        id, thread_id, sender_user_id, body, filtered_flags, read_at, created_at
      )
    `)
        .eq("id", threadId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const thread = data as unknown as Omit<MarketplaceThreadFull, "offers">;

    if (
        thread.buyer_user_id !== user.id &&
        thread.seller_user_id !== user.id
    ) {
        return null;
    }

    // Charge les offres via (listing_id, buyer_user_id)
    const { data: offersData } = await supabase
        .from("marketplace_offers")
        .select(
            "id, buyer_user_id, listing_id, amount_cents, status, responded_at, expires_at, parent_offer_id, created_at"
        )
        .eq("listing_id", thread.listing_id)
        .eq("buyer_user_id", thread.buyer_user_id)
        .order("created_at", { ascending: true });

    const offers = (offersData ?? []) as MarketplaceOffer[];

    return {
        ...thread,
        listing: thread.listing
            ? {
                ...thread.listing,
                photos: [...thread.listing.photos].sort(
                    (a, b) => a.position - b.position
                ),
            }
            : null,
        messages: [...thread.messages].sort((a, b) =>
            a.created_at.localeCompare(b.created_at)
        ),
        offers,
    };
}