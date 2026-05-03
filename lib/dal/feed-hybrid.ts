import { createClient } from "@/lib/supabase/server";
import type { FeedPost } from "@/lib/dal/posts";
import type { EventListItem } from "@/lib/dal/events";
import { getFeedPosts } from "@/lib/dal/posts";
import { getUpcomingEvents } from "@/lib/dal/events";

export type FeedItem =
    | { kind: "post"; post: FeedPost; sortAt: string }
    | { kind: "event"; event: EventListItem; sortAt: string };

/**
 * Fil hybride : mix posts et events à venir, triés par date de pertinence.
 * - Posts : triés par created_at desc
 * - Events : triés par starts_at asc (les plus proches en premier)
 * On entrelace en mettant les events publiés récemment en haut, puis les posts.
 *
 * Stratégie simple : on fusionne et on trie par "fraîcheur" (max(created_at, starts_at - 30j)).
 */
export async function getHybridFeed(opts: {
    limit?: number;
}): Promise<FeedItem[]> {
    const limit = opts.limit ?? 30;
    const [posts, events] = await Promise.all([
        getFeedPosts({ limit }),
        getUpcomingEvents({ limit: 20 }),
    ]);

    const items: FeedItem[] = [];
    for (const p of posts) {
        items.push({ kind: "post", post: p, sortAt: p.created_at });
    }
    for (const e of events) {
        // Tri events sur leur created_at proxy : on utilise starts_at - 30j pour les pousser plus haut quand ils approchent
        items.push({ kind: "event", event: e, sortAt: e.starts_at });
    }

    // Tri descendant
    items.sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1));

    return items.slice(0, limit);
}

export async function getHybridFeedFollowing(opts: {
    user_id: string;
    limit?: number;
}): Promise<FeedItem[]> {
    const supabase = await createClient();
    const { data: follows } = await supabase
        .from("follows")
        .select("target_org_id")
        .eq("follower_user_id", opts.user_id);
    const orgIds = (follows ?? []).map((f) => f.target_org_id);
    if (orgIds.length === 0) return [];

    const { getFeedPostsFollowing } = await import("@/lib/dal/posts");
    const limit = opts.limit ?? 30;

    const [posts, eventsLists] = await Promise.all([
        getFeedPostsFollowing({ user_id: opts.user_id, limit }),
        Promise.all(orgIds.map((orgId) => getUpcomingEvents({ orgId, limit: 5 }))),
    ]);

    const events = eventsLists.flat();
    const items: FeedItem[] = [];
    for (const p of posts) {
        items.push({ kind: "post", post: p, sortAt: p.created_at });
    }
    for (const e of events) {
        items.push({ kind: "event", event: e, sortAt: e.starts_at });
    }
    items.sort((a, b) => (a.sortAt < b.sortAt ? 1 : -1));

    return items.slice(0, limit);
}