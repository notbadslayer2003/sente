import { createClient } from "@/lib/supabase/server";

export type NotificationItem = {
    id: string;
    type: string;
    read_at: string | null;
    created_at: string;
    actor: {
        id: string;
        name: string;
        avatar_url: string | null;
    } | null;
    actor_org: {
        id: string;
        name: string;
        slug: string;
        org_type: string;
    } | null;
    target_post_id: string | null;
    target_comment_id: string | null;
    target_org: {
        id: string;
        name: string;
        slug: string;
        org_type: string;
    } | null;
    payload: Record<string, unknown>;
};

export async function getNotifications(opts: {
    limit?: number;
    onlyUnread?: boolean;
}): Promise<NotificationItem[]> {
    const limit = opts.limit ?? 20;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    let q = supabase
        .from("notifications")
        .select(
            `id, type, read_at, created_at, payload,
             target_post_id, target_comment_id,
             actor:profiles!actor_user_id(id, full_name, avatar_url),
             actor_org:organizations!actor_org_id(id, name, slug, org_type),
             target_org:organizations!target_org_id(id, name, slug, org_type)`
        )
        .eq("recipient_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (opts.onlyUnread) q = q.is("read_at", null);

    const { data, error } = await q;
    if (error || !data) return [];

    return data.map((r) => {
        const actor = Array.isArray(r.actor) ? r.actor[0] : r.actor;
        const actorOrg = Array.isArray(r.actor_org) ? r.actor_org[0] : r.actor_org;
        const targetOrg = Array.isArray(r.target_org) ? r.target_org[0] : r.target_org;

        return {
            id: r.id,
            type: r.type,
            read_at: r.read_at,
            created_at: r.created_at,
            actor: actor
                ? {
                    id: actor.id,
                    name: actor.full_name ?? "Pêcheur",
                    avatar_url: actor.avatar_url,
                }
                : null,
            actor_org: actorOrg
                ? {
                    id: actorOrg.id,
                    name: actorOrg.name,
                    slug: actorOrg.slug,
                    org_type: actorOrg.org_type,
                }
                : null,
            target_post_id: r.target_post_id,
            target_comment_id: r.target_comment_id,
            target_org: targetOrg
                ? {
                    id: targetOrg.id,
                    name: targetOrg.name,
                    slug: targetOrg.slug,
                    org_type: targetOrg.org_type,
                }
                : null,
            payload: (r.payload as Record<string, unknown>) ?? {},
        };
    });
}

export async function getUnreadNotificationCount(): Promise<number> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", user.id)
        .is("read_at", null);

    return count ?? 0;
}