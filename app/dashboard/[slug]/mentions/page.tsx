import Link from "next/link";
import Image from "next/image";
import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import { MentionRow } from "@/components/sente/mention-row";

type Params = Promise<{ slug: string }>;

export default async function MentionsPage({
                                               params,
                                           }: {
    params: Params;
}) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    const supabase = await createClient();

    // Mentions actives de cette org
    const { data: mentions } = await supabase
        .from("post_org_mentions")
        .select(
            `post_id, organization_id, removed_at, created_at,
             post:posts!post_id(
                id, content, photos, created_at, status, deleted_at,
                author:profiles!author_user_id(id, full_name, avatar_url)
             )`
        )
        .eq("organization_id", ctx.org.id)
        .is("removed_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

    type RawMention = (typeof mentions)[number];
    const items = (mentions ?? [])
        .map((m: RawMention) => {
            const post = Array.isArray(m.post) ? m.post[0] : m.post;
            if (!post || post.status !== "published" || post.deleted_at) return null;
            const author = Array.isArray(post.author) ? post.author[0] : post.author;
            return {
                post_id: post.id,
                organization_id: m.organization_id,
                content: post.content,
                photo_url: post.photos?.[0] ?? null,
                created_at: post.created_at,
                author_name: author?.full_name ?? "Pêcheur",
                author_avatar: author?.avatar_url ?? null,
            };
        })
        .filter((i): i is NonNullable<typeof i> => i !== null);

    return (
        <div className="space-y-10">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Communauté
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Mentions de {ctx.org.name}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground max-w-xl">
                    Tous les posts qui mentionnent {ctx.org.name}. Tu peux retirer
                    silencieusement une mention si nécessaire — l&apos;auteur du post n&apos;est
                    pas notifié.
                </p>
            </div>

            {items.length === 0 ? (
                <div className="border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        Aucun post ne mentionne {ctx.org.name} pour le moment.
                    </p>
                </div>
            ) : (
                <ul className="space-y-4">
                    {items.map((m) => (
                        <li key={m.post_id}>
                            <MentionRow mention={m} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}