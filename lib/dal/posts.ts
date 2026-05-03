import {createClient} from "@/lib/supabase/server";

export type PostListItem = {
    id: string;
    content: string;
    photos: string[];
    espece: string | null;
    weight_kg: number | null;
    matos: string | null;
    likes_count: number;
    comments_count: number;
    created_at: string;
    // Auteur : soit user soit org
    author: {
        kind: "user" | "org";
        id: string;
        name: string;
        avatar_url: string | null;
        org_slug: string | null;
        org_type: string | null;
        is_sente_official: boolean;
        followers_count: number; // 0 pour kind=user
        is_followed_by_me: boolean; // false pour kind=user
    };
    // Mentions actives (étangs/magasins taggés)
    mentions: Array<{
        id: string;
        slug: string;
        name: string;
        org_type: string;
    }>;
};

export type FeedPost = PostListItem & { is_liked_by_me: boolean };


export async function getFeedPosts(opts: {
    limit?: number;
    cursor?: string;
}): Promise<FeedPost[]> {
    const limit = opts.limit ?? 20;
    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();

    let q = supabase
        .from("posts")
        .select(
            `id, content, photos, espece, weight_kg, matos,
             likes_count, comments_count, created_at,
             author_user_id, author_org_id,
             user_profile:profiles!author_user_id(id, full_name, avatar_url),
             org:organizations!author_org_id(id, slug, name, org_type, cover_image_url, is_sente_official),
             mentions:post_org_mentions!post_id(
                organization_id, removed_at,
                org:organizations!organization_id(id, slug, name, org_type)
             )`
        )
        .eq("status", "published")
        .is("deleted_at", null)
        .order("created_at", {ascending: false})
        .limit(limit);

    if (opts.cursor) q = q.lt("created_at", opts.cursor);

    const {data, error} = await q;
    if (error || !data) {
        if (error) console.error("getFeedPosts failed:", error);
        return [];
    }

    const items = data
        .map(mapToPostListItem)
        .filter((p): p is PostListItem => p !== null);

    // Récupère les likes du user courant
    let likedSet = new Set<string>();
    if (user && items.length > 0) {
        const {data: likes} = await supabase
            .from("post_likes")
            .select("post_id")
            .in(
                "post_id",
                items.map((p) => p.id)
            )
            .eq("user_id", user.id);
        likedSet = new Set((likes ?? []).map((l) => l.post_id));
    }

// Récupère les follows du user courant pour les orgs auteurs
    let followedSet = new Set<string>();
    if (user) {
        const orgIds = items
            .filter((p) => p.author.kind === "org")
            .map((p) => p.author.id);
        if (orgIds.length > 0) {
            const {data: follows} = await supabase
                .from("follows")
                .select("target_org_id")
                .in("target_org_id", orgIds)
                .eq("follower_user_id", user.id);
            followedSet = new Set((follows ?? []).map((f) => f.target_org_id));
        }
    }

    return items.map((p) => ({
        ...p,
        is_liked_by_me: likedSet.has(p.id),
        author: {
            ...p.author,
            is_followed_by_me:
                p.author.kind === "org" ? followedSet.has(p.author.id) : false,
        },
    }));
}

// Pour le fil "Suivi" : posts des orgs que l'utilisateur suit
export async function getFeedPostsFollowing(opts: {
    user_id: string;
    limit?: number;
    cursor?: string;
}): Promise<FeedPost[]> {
    const limit = opts.limit ?? 20;
    const supabase = await createClient();

    const {data: follows} = await supabase
        .from("follows")
        .select("target_org_id")
        .eq("follower_user_id", opts.user_id);

    const followedOrgIds = (follows ?? []).map((f) => f.target_org_id);
    if (followedOrgIds.length === 0) return [];

    let q = supabase
        .from("posts")
        .select(
            `id, content, photos, espece, weight_kg, matos,
             likes_count, comments_count, created_at,
             author_user_id, author_org_id,
             user_profile:profiles!author_user_id(id, full_name, avatar_url),
             org:organizations!author_org_id(id, slug, name, org_type, cover_image_url, is_sente_official),
             mentions:post_org_mentions!post_id(
                organization_id, removed_at,
                org:organizations!organization_id(id, slug, name, org_type)
             )`
        )
        .eq("status", "published")
        .is("deleted_at", null)
        .in("author_org_id", followedOrgIds)
        .order("created_at", {ascending: false})
        .limit(limit);

    if (opts.cursor) q = q.lt("created_at", opts.cursor);

    const {data} = await q;
    const items = (data ?? [])
        .map(mapToPostListItem)
        .filter((p): p is PostListItem => p !== null);

    // Récupère les likes
    let likedSet = new Set<string>();
    if (items.length > 0) {
        const {data: likes} = await supabase
            .from("post_likes")
            .select("post_id")
            .in(
                "post_id",
                items.map((p) => p.id)
            )
            .eq("user_id", opts.user_id);
        likedSet = new Set((likes ?? []).map((l) => l.post_id));
    }

// Pour le fil "suivi", toutes les orgs auteurs sont par définition suivies
    return items.map((p) => ({
        ...p,
        is_liked_by_me: likedSet.has(p.id),
        author: {
            ...p.author,
            is_followed_by_me: p.author.kind === "org",
        },
    }));
}

// Récupère les orgs dont le user est membre (pour le composer côté org)
export async function getMyOrgs(): Promise<
    Array<{ id: string; name: string; slug: string; org_type: string }>
> {
    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();
    if (!user) return [];

    const {data} = await supabase
        .from("memberships")
        .select(
            `organization:organizations!organization_id(id, name, slug, org_type, status, deleted_at)`
        )
        .eq("user_id", user.id)
        .not("accepted_at", "is", null);

    if (!data) return [];

    return data
        .map((m) => {
            const o = Array.isArray(m.organization) ? m.organization[0] : m.organization;
            return o;
        })
        .filter(
            (o): o is {
                id: string;
                name: string;
                slug: string;
                org_type: string;
                status: string;
                deleted_at: string | null
            } =>
                !!o && o.status === "active" && !o.deleted_at
        )
        .map((o) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            org_type: o.org_type,
        }));
}

function mapToPostListItem(row: unknown): PostListItem | null {
    const r = row as {
        id: string;
        content: string;
        photos: string[] | null;
        espece: string | null;
        weight_kg: number | null;
        matos: string | null;
        likes_count: number;
        comments_count: number;
        created_at: string;
        author_user_id: string | null;
        author_org_id: string | null;
        user_profile: { id: string; full_name: string | null; avatar_url: string | null } | {
            id: string;
            full_name: string | null;
            avatar_url: string | null
        }[] | null;
        org: {
            id: string;
            slug: string;
            name: string;
            org_type: string;
            cover_image_url: string | null;
            is_sente_official: boolean;
            followers_count: number;
        } | {
            id: string;
            slug: string;
            name: string;
            org_type: string;
            cover_image_url: string | null;
            is_sente_official: boolean;
            followers_count: number
        }[] | null;
        mentions: Array<{
            organization_id: string;
            removed_at: string | null;
            org: { id: string; slug: string; name: string; org_type: string } | {
                id: string;
                slug: string;
                name: string;
                org_type: string
            }[] | null;
        }> | null;
    };

    const userProfile = Array.isArray(r.user_profile) ? r.user_profile[0] : r.user_profile;
    const org = Array.isArray(r.org) ? r.org[0] : r.org;

    let author: PostListItem["author"];
    if (r.author_user_id && userProfile) {
        author = {
            kind: "user",
            id: userProfile.id,
            name: userProfile.full_name ?? "Pêcheur",
            avatar_url: userProfile.avatar_url,
            org_slug: null,
            org_type: null,
            is_sente_official: false,
            followers_count: 0,
            is_followed_by_me: false, // on remplit après
        };
    } else if (r.author_org_id && org) {
        author = {
            kind: "org",
            id: org.id,
            name: org.name,
            avatar_url: org.cover_image_url,
            org_slug: org.slug,
            org_type: org.org_type,
            is_sente_official: org.is_sente_official,
            followers_count: org.followers_count ?? 0,
            is_followed_by_me: false, // on remplit après
        };
    } else {
        return null;
    }

    const mentions = (r.mentions ?? [])
        .filter((m) => !m.removed_at)
        .map((m) => {
            const mo = Array.isArray(m.org) ? m.org[0] : m.org;
            return mo
                ? {id: mo.id, slug: mo.slug, name: mo.name, org_type: mo.org_type}
                : null;
        })
        .filter((m): m is { id: string; slug: string; name: string; org_type: string } => m !== null);

    return {
        id: r.id,
        content: r.content,
        photos: r.photos ?? [],
        espece: r.espece,
        weight_kg: r.weight_kg,
        matos: r.matos,
        likes_count: r.likes_count,
        comments_count: r.comments_count,
        created_at: r.created_at,
        author,
        mentions,
    };
}

export type PostDetail = PostListItem & {
    is_liked_by_me: boolean;
};

export type CommentTreeItem = {
    id: string;
    content: string;
    created_at: string;
    edited_at: string | null;
    likes_count: number;
    is_liked_by_me: boolean;
    is_hidden: boolean;
    is_my_comment: boolean;
    can_hide: boolean;
    author: {
        id: string;
        name: string;
        avatar_url: string | null;
    };
    replies: CommentTreeItem[];
};

export async function getPostDetail(
    postId: string
): Promise<PostDetail | null> {
    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();

    const {data, error} = await supabase
        .from("posts")
        .select(
            `id, content, photos, espece, weight_kg, matos,
             likes_count, comments_count, created_at,
             author_user_id, author_org_id,
             user_profile:profiles!author_user_id(id, full_name, avatar_url),
             org:organizations!author_org_id(id, slug, name, org_type, cover_image_url, is_sente_official),
             mentions:post_org_mentions!post_id(
                organization_id, removed_at,
                org:organizations!organization_id(id, slug, name, org_type)
             )`
        )
        .eq("id", postId)
        .eq("status", "published")
        .is("deleted_at", null)
        .maybeSingle();

    if (error || !data) return null;

    // Récupère le like de l'utilisateur courant si connecté
    let isLikedByMe = false;
    if (user) {
        const {data: like} = await supabase
            .from("post_likes")
            .select("post_id")
            .eq("post_id", postId)
            .eq("user_id", user.id)
            .maybeSingle();
        isLikedByMe = !!like;
    }

    const base = mapToPostListItem(data);
    if (!base) return null;

// is_followed_by_me pour l'auteur si c'est une org
    let isFollowedByMe = false;
    if (user && base.author.kind === "org") {
        const { data: f } = await supabase
            .from("follows")
            .select("target_org_id")
            .eq("target_org_id", base.author.id)
            .eq("follower_user_id", user.id)
            .maybeSingle();
        isFollowedByMe = !!f;
    }

    return {
        ...base,
        is_liked_by_me: isLikedByMe,
        author: {
            ...base.author,
            is_followed_by_me: isFollowedByMe,
        },
    };
}

export async function getPostComments(
    postId: string
): Promise<CommentTreeItem[]> {
    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();

    // Vérifie si l'utilisateur courant est l'auteur du post (pour le bouton "Masquer")
    const {data: post} = await supabase
        .from("posts")
        .select("author_user_id")
        .eq("id", postId)
        .single();
    const isPostAuthor = !!post && post.author_user_id === user?.id;

    let q = supabase
        .from("post_comments")
        .select(
            `id, content, created_at, edited_at, hidden_at, likes_count, parent_id,
         author_user_id,
         author:profiles!author_user_id(id, full_name, avatar_url)`
        )
        .eq("post_id", postId)
        .is("deleted_at", null)
        .order("created_at", {ascending: true});

    // Filtrage hidden côté DAL :
    // - non connecté → on ne ramène que les non-masqués
    // - connecté → la RLS s'occupe du filtrage (peut voir : non-masqués + ses propres + s'il est auteur du post)
    // La RLS marche, mais on s'assure aussi côté DAL pour éviter les fuites.
    if (!user) {
        q = q.is("hidden_at", null);
    }

    const {data: comments, error} = await q;

    if (error || !comments) return [];

    // Récupère les likes du user courant sur ces commentaires
    const commentIds = comments.map((c) => c.id);
    let likedSet = new Set<string>();
    if (user && commentIds.length > 0) {
        const {data: likes} = await supabase
            .from("comment_likes")
            .select("comment_id")
            .in("comment_id", commentIds)
            .eq("user_id", user.id);
        likedSet = new Set((likes ?? []).map((l) => l.comment_id));
    }

    // Construit l'arbre 2 niveaux
    type Row = (typeof comments)[number];
    const byId = new Map<string, CommentTreeItem>();
    const roots: CommentTreeItem[] = [];

    const buildItem = (c: Row): CommentTreeItem => {
        const author = Array.isArray(c.author) ? c.author[0] : c.author;
        return {
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            edited_at: c.edited_at,
            likes_count: c.likes_count ?? 0,
            is_liked_by_me: likedSet.has(c.id),
            is_hidden: !!c.hidden_at,
            is_my_comment: c.author_user_id === user?.id,
            can_hide: isPostAuthor && !c.hidden_at,
            author: {
                id: author?.id ?? "",
                name: author?.full_name ?? "Pêcheur",
                avatar_url: author?.avatar_url ?? null,
            },
            replies: [],
        };
    };

    // Premier passage : tous les items
    for (const c of comments) {
        byId.set(c.id, buildItem(c));
    }
    // Deuxième passage : structure parent/enfant
    for (const c of comments) {
        const item = byId.get(c.id);
        if (!item) continue;
        if (c.parent_id) {
            const parent = byId.get(c.parent_id);
            if (parent) parent.replies.push(item);
            else roots.push(item); // orphelin = root par sécurité
        } else {
            roots.push(item);
        }
    }

    return roots;
}

export async function getPostsByOrg(orgId: string): Promise<FeedPost[]> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from("posts")
        .select(
            `id, content, photos, espece, weight_kg, matos,
             likes_count, comments_count, created_at,
             author_user_id, author_org_id,
             user_profile:profiles!author_user_id(id, full_name, avatar_url),
             org:organizations!author_org_id(id, slug, name, org_type, cover_image_url, is_sente_official),
             mentions:post_org_mentions!post_id(
                organization_id, removed_at,
                org:organizations!organization_id(id, slug, name, org_type)
             )`
        )
        .eq("author_org_id", orgId)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

    if (error || !data) {
        if (error) console.error("getPostsByOrg failed:", error);
        return [];
    }

    const items = data
        .map(mapToPostListItem)
        .filter((p): p is PostListItem => p !== null);

    let likedSet = new Set<string>();
    if (user && items.length > 0) {
        const { data: likes } = await supabase
            .from("post_likes")
            .select("post_id")
            .in("post_id", items.map((p) => p.id))
            .eq("user_id", user.id);
        likedSet = new Set((likes ?? []).map((l) => l.post_id));
    }

    return items.map((p) => ({
        ...p,
        is_liked_by_me: likedSet.has(p.id),
        author: { ...p.author, is_followed_by_me: false },
    }));
}