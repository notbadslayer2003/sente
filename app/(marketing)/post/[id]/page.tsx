import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowLeft} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
import {getPostDetail, getPostComments} from "@/lib/dal/posts";
import {PostActionsBar} from "@/components/sente/post-actions-bar";
import {CommentsSection} from "@/components/sente/comments-section";
import {PostMetaRow} from "@/components/sente/post-meta-row";
import {FollowButton} from "@/components/sente/follow-button";

type Params = Promise<{ id: string }>;

export async function generateMetadata({params}: { params: Params }) {
    const {id} = await params;
    const post = await getPostDetail(id);
    if (!post) return {title: "Post introuvable — Sente"};
    const excerpt = post.content.slice(0, 160);
    return {
        title: `${post.author.name} — Sente`,
        description: excerpt,
        openGraph: {
            title: `${post.author.name} sur Sente`,
            description: excerpt,
            images: post.photos[0] ? [post.photos[0]] : undefined,
        },
    };
}

export default async function PostPage({params}: { params: Params }) {
    const {id} = await params;
    if (!id || id.length < 36) notFound();

    const [post, comments] = await Promise.all([
        getPostDetail(id),
        getPostComments(id),
    ]);
    if (!post) notFound();

    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();

    return (
        <section className="bg-background min-h-screen pt-24 pb-20">
            <div className="mx-auto max-w-2xl px-6 sm:px-8">
                {/* Lien retour */}
                <Link
                    href="/feed"
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-8"
                >
                    <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2}/>
                    Retour au fil
                </Link>

                {/* Carte post */}
                <article className="border border-border bg-secondary/10">
                    {/* Header auteur */}
                    <header className="px-6 py-5 flex items-center gap-4 border-b border-border">
                        <AuthorAvatar author={post.author}/>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight flex items-center gap-2 flex-wrap">
                                {post.author.kind === "org" ? (
                                    <Link
                                        href={
                                            post.author.org_type === "etang"
                                                ? `/lieux/${post.author.org_slug}`
                                                : `/magasins/${post.author.org_slug}`
                                        }
                                        className="hover:text-accent transition-colors"
                                    >
                                        {post.author.name}
                                    </Link>
                                ) : (
                                    <span>{post.author.name}</span>
                                )}
                                {post.author.is_sente_official && (
                                    <span
                                        className="px-2 py-0.5 text-[9px] uppercase tracking-wide bg-primary/15 text-primary">
                                        Officiel
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {new Date(post.created_at).toLocaleString("fr-BE", {
                                    dateStyle: "long",
                                    timeStyle: "short",
                                })}
                            </p>
                        </div>
                        {post.author.kind === "org" && (
                            <FollowButton
                                orgId={post.author.id}
                                initialFollowing={post.author.is_followed_by_me}
                                initialFollowersCount={post.author.followers_count}
                                isLoggedIn={!!user}
                                size="sm"
                            />
                        )}
                    </header>

                    {/* Photos */}
                    {post.photos.length > 0 && (
                        <PhotoGallery photos={post.photos} title={post.author.name}/>
                    )}

                    {/* Texte + métadonnées */}
                    <div className="px-6 py-6 space-y-4">
                        <p className="text-base leading-relaxed whitespace-pre-line">
                            {post.content}
                        </p>

                        <PostMetaRow
                            espece={post.espece}
                            weight_kg={post.weight_kg}
                            matos={post.matos}
                            mentions={post.mentions}
                        />
                    </div>

                    {/* Actions bar */}
                    <div className="px-3 py-2 border-t border-border">
                        <PostActionsBar
                            postId={post.id}
                            initialLiked={post.is_liked_by_me}
                            initialLikesCount={post.likes_count}
                            commentsCount={post.comments_count}
                            isLoggedIn={!!user}
                            commentsHref="#comments"
                            variant="detail"
                        />
                    </div>
                </article>

                {/* Section commentaires */}
                <div className="mt-10" id="comments">
                    <CommentsSection
                        postId={post.id}
                        comments={comments}
                        isLoggedIn={!!user}
                        totalCount={post.comments_count}
                    />
                </div>
            </div>
        </section>
    );
}

function AuthorAvatar({
                          author,
                      }: {
    author: { name: string; avatar_url: string | null };
}) {
    if (author.avatar_url) {
        return (
            <div className="w-12 h-12 relative bg-secondary border border-border overflow-hidden shrink-0">
                <Image
                    src={author.avatar_url}
                    alt={author.name}
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized
                />
            </div>
        );
    }
    const initials = author.name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    return (
        <div
            className="w-12 h-12 flex items-center justify-center bg-accent/10 text-accent text-sm font-medium uppercase tracking-wide shrink-0">
            {initials || "?"}
        </div>
    );
}

function PhotoGallery({photos, title}: { photos: string[]; title: string }) {
    // 1 photo : pleine largeur
    if (photos.length === 1) {
        return (
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-background overflow-hidden">
                <Image
                    src={photos[0]}
                    alt={title}
                    fill
                    sizes="(max-width: 768px) 100vw, 700px"
                    className="object-contain"
                    unoptimized
                    priority
                />
            </div>
        );
    }

    // 2 photos : grid 2 colonnes
    if (photos.length === 2) {
        return (
            <div className="grid grid-cols-2 gap-1">
                {photos.map((url, i) => (
                    <div
                        key={url}
                        className="relative aspect-square bg-background overflow-hidden"
                    >
                        <Image
                            src={url}
                            alt={`${title} — ${i + 1}`}
                            fill
                            sizes="(max-width: 768px) 50vw, 350px"
                            className="object-cover"
                            unoptimized
                        />
                    </div>
                ))}
            </div>
        );
    }

    // 3+ photos : 1 grande + grille
    return (
        <div className="space-y-1">
            <div className="relative w-full aspect-[16/10] bg-background overflow-hidden">
                <Image
                    src={photos[0]}
                    alt={`${title} — 1`}
                    fill
                    sizes="(max-width: 768px) 100vw, 700px"
                    className="object-contain"
                    unoptimized
                    priority
                />
            </div>
            <div
                className={`grid gap-1 ${
                    photos.length === 3 ? "grid-cols-2" : "grid-cols-3"
                }`}
            >
                {photos.slice(1).map((url, i) => (
                    <div
                        key={url}
                        className="relative aspect-square bg-background overflow-hidden"
                    >
                        <Image
                            src={url}
                            alt={`${title} — ${i + 2}`}
                            fill
                            sizes="(max-width: 768px) 33vw, 230px"
                            className="object-cover"
                            unoptimized
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}