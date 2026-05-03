"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import type { PostListItem } from "@/lib/dal/posts";
import { deletePostAction } from "@/app/actions/posts";
import { PostActionsBar } from "@/components/sente/post-actions-bar";
import { PostMetaRow } from "@/components/sente/post-meta-row";
import {FollowButton} from "@/components/sente/follow-button";
import {ReportButton} from "@/components/sente/report-button";

export function PostCard({
                             post,
                             currentUserId,
                             initialLiked,
                             canDelete = false,
                         }: {
    post: PostListItem;
    currentUserId: string | null;
    initialLiked: boolean;
    canDelete?: boolean;
}) {
    const [isPending, startTransition] = useTransition();
    const [hidden, setHidden] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const isMyPost =
        canDelete ||
        (post.author.kind === "user" && post.author.id === currentUserId);

    const onDelete = () => {
        if (!confirm("Supprimer ce post ? Action irréversible.")) return;
        const fd = new FormData();
        fd.set("post_id", post.id);
        startTransition(async () => {
            const r = await deletePostAction(fd);
            if (r.ok) setHidden(true);
        });
    };

    if (hidden) return null;

    return (
        <article className="border border-border bg-secondary/10">
            {/* Header */}
            <header className="px-5 py-4 flex items-center gap-3 border-b border-border">
                <AuthorAvatar author={post.author} />
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
                            <span className="px-2 py-0.5 text-[9px] uppercase tracking-wide bg-primary/15 text-primary">
            Officiel
          </span>
                        )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(post.created_at)}
                    </p>
                </div>

                {/* Bouton Suivre si l'auteur est une org et pas mon post */}
                {post.author.kind === "org" && (
                    <FollowButton
                        orgId={post.author.id}
                        initialFollowing={post.author.is_followed_by_me}
                        initialFollowersCount={post.author.followers_count}
                        isLoggedIn={currentUserId !== null}
                        size="sm"
                    />
                )}

                {(isMyPost || currentUserId !== null) && (
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="p-1.5 hover:bg-secondary rounded-full transition-colors"
                            aria-label="Actions"
                        >
                            <MoreHorizontal
                                className="w-4 h-4 text-muted-foreground"
                                strokeWidth={2}
                            />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-full mt-1 z-10 bg-background border border-border min-w-[140px]">
                                {!isMyPost && (
                                    <div className="px-2 py-1">
                                        <ReportButton
                                            targetType="post"
                                            targetId={post.id}
                                            isLoggedIn={currentUserId !== null}
                                        />
                                    </div>
                                )}
                                {isMyPost && (
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        disabled={isPending}
                                        className="w-full text-left px-4 py-2 text-xs uppercase tracking-wide text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                    >
                                        Supprimer
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </header>

            {/* Contenu */}
            {/* Contenu texte (cliquable) */}
            <Link href={`/post/${post.id}`} className="block">
                <div className="px-5 py-4">
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                        {post.content}
                    </p>
                </div>
            </Link>

            {/* Méta (avec liens vers étangs/magasins, hors zone cliquable) */}
            {(post.espece || post.weight_kg || post.matos || post.mentions.length > 0) && (
                <div className="px-5 pb-4">
                    <PostMetaRow
                        espece={post.espece}
                        weight_kg={post.weight_kg}
                        matos={post.matos}
                        mentions={post.mentions}
                    />
                </div>
            )}

            {/* Photos (cliquables séparément) */}
            {post.photos.length > 0 && (
                <Link href={`/post/${post.id}`} className="block">
                    <div
                        className={`grid gap-1 ${
                            post.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"
                        }`}
                    >
                        {post.photos.slice(0, 4).map((url, i) => (
                            <div
                                key={url}
                                className={`relative bg-background overflow-hidden ${
                                    post.photos.length === 1
                                        ? "aspect-[16/10]"
                                        : "aspect-square"
                                }`}
                            >
                                <Image
                                    src={url}
                                    alt={`Photo ${i + 1}`}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 600px"
                                    className="object-cover"
                                    unoptimized
                                />
                                {i === 3 && post.photos.length > 4 && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white font-display text-3xl">
                                +{post.photos.length - 4}
                            </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Link>
            )}

            {/* Actions */}
            <div className="px-3 py-2 border-t border-border">
                <PostActionsBar
                    postId={post.id}
                    initialLiked={initialLiked}
                    initialLikesCount={post.likes_count}
                    commentsCount={post.comments_count}
                    isLoggedIn={currentUserId !== null}
                    commentsHref={`/post/${post.id}#comments`}
                    variant="card"
                />
            </div>
        </article>
    );
}

function AuthorAvatar({ author }: { author: PostListItem["author"] }) {
    if (author.avatar_url) {
        return (
            <div className="w-10 h-10 relative bg-secondary border border-border overflow-hidden shrink-0">
                <Image
                    src={author.avatar_url}
                    alt={author.name}
                    fill
                    sizes="40px"
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
        <div className="w-10 h-10 flex items-center justify-center bg-accent/10 text-accent text-xs font-medium uppercase tracking-wide shrink-0">
            {initials || "?"}
        </div>
    );
}

function formatDate(d: string): string {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.round(diffMs / (1000 * 60));
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    if (diffHour < 24) return `il y a ${diffHour} h`;
    if (diffDay < 7) return `il y a ${diffDay} j`;
    return date.toLocaleDateString("fr-BE", {
        day: "numeric",
        month: "short",
        year: diffDay > 365 ? "numeric" : undefined,
    });
}