"use client";

import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { togglePostLikeAction } from "@/app/actions/post-engagement";

export function PostActionsBar({
                                   postId,
                                   initialLiked,
                                   initialLikesCount,
                                   commentsCount,
                                   isLoggedIn,
                                   commentsHref,
                                   variant = "card",
                               }: {
    postId: string;
    initialLiked: boolean;
    initialLikesCount: number;
    commentsCount: number;
    isLoggedIn: boolean;
    /** Lien des commentaires (page détail ou ancre #comments) */
    commentsHref: string;
    /** "card" pour le feed, "detail" pour la page post */
    variant?: "card" | "detail";
}) {
    const [liked, setLiked] = useState(initialLiked);
    const [likesCount, setLikesCount] = useState(initialLikesCount);
    const [isPending, startTransition] = useTransition();

    const onLike = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isLoggedIn) {
            window.location.href =
                "/login?next=" + encodeURIComponent(window.location.pathname);
            return;
        }
        const prevLiked = liked;
        const prevCount = likesCount;
        setLiked(!liked);
        setLikesCount(liked ? likesCount - 1 : likesCount + 1);

        const fd = new FormData();
        fd.set("post_id", postId);
        startTransition(async () => {
            const r = await togglePostLikeAction(fd);
            if (r.ok && r.data) {
                setLiked(r.data.liked);
                setLikesCount(r.data.likes_count);
            } else {
                setLiked(prevLiked);
                setLikesCount(prevCount);
            }
        });
    };

    return (
        <div
            className={`flex items-center gap-1 text-sm ${
                variant === "detail" ? "" : ""
            }`}
        >
            <button
                type="button"
                onClick={onLike}
                disabled={isPending}
                className={`flex items-center gap-2 px-3 py-2 rounded-full transition-colors group ${
                    liked
                        ? "text-destructive"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                } disabled:opacity-50`}
                aria-label={liked ? "Retirer le like" : "Liker"}
            >
                <Heart
                    className={`w-5 h-5 transition-transform group-active:scale-90 ${
                        liked ? "fill-current" : ""
                    }`}
                    strokeWidth={1.75}
                />
                <span className="text-xs tabular-nums">{likesCount}</span>
            </button>

            <Link
                href={commentsHref}
                className="flex items-center gap-2 px-3 py-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
                <MessageCircle className="w-5 h-5" strokeWidth={1.75} />
                <span className="text-xs tabular-nums">{commentsCount}</span>
            </Link>
        </div>
    );
}