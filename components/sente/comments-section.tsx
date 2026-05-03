"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CommentTreeItem } from "@/lib/dal/posts";
import {
    createCommentAction,
    updateCommentAction,
    deleteCommentAction,
    hideCommentAction,
    toggleCommentLikeAction,
} from "@/app/actions/post-engagement";

export function CommentsSection({
                                    postId,
                                    comments,
                                    isLoggedIn,
                                }: {
    postId: string;
    comments: CommentTreeItem[];
    isLoggedIn: boolean;
}) {
    return (
        <div id="comments" className="space-y-6">
            <h2 className="font-display text-xl tracking-tight">
                Commentaires ({comments.length})
            </h2>

            {isLoggedIn ? (
                <CommentComposer postId={postId} parentId={null} />
            ) : (
                <div className="border border-border bg-secondary/30 p-4 text-sm">
                    <Link
                        href={`/login?next=/post/${postId}`}
                        className="text-accent hover:text-accent/80 transition-colors uppercase tracking-wide"
                    >
                        Connecte-toi
                    </Link>{" "}
                    pour commenter.
                </div>
            )}

            {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Aucun commentaire pour le moment.
                </p>
            ) : (
                <ul className="space-y-5">
                    {comments.map((c) => (
                        <li key={c.id}>
                            <CommentItem
                                comment={c}
                                postId={postId}
                                isLoggedIn={isLoggedIn}
                                depth={0}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function CommentItem({
                         comment,
                         postId,
                         isLoggedIn,
                         depth,
                     }: {
    comment: CommentTreeItem;
    postId: string;
    isLoggedIn: boolean;
    depth: number;
}) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [replying, setReplying] = useState(false);
    const [liked, setLiked] = useState(comment.is_liked_by_me);
    const [likesCount, setLikesCount] = useState(comment.likes_count);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onLike = () => {
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
        fd.set("comment_id", comment.id);
        startTransition(async () => {
            const r = await toggleCommentLikeAction(fd);
            if (r.ok && r.data) {
                setLiked(r.data.liked);
                setLikesCount(r.data.likes_count);
            } else {
                setLiked(prevLiked);
                setLikesCount(prevCount);
            }
        });
    };

    const onDelete = () => {
        if (!confirm("Supprimer ce commentaire ?")) return;
        const fd = new FormData();
        fd.set("comment_id", comment.id);
        startTransition(async () => {
            const r = await deleteCommentAction(fd);
            if (r.ok) router.refresh();
            else setError(r.error);
        });
    };

    const onHide = () => {
        if (!confirm("Masquer ce commentaire ? Il restera visible pour son auteur.")) return;
        const fd = new FormData();
        fd.set("comment_id", comment.id);
        startTransition(async () => {
            const r = await hideCommentAction(fd);
            if (r.ok) router.refresh();
            else setError(r.error);
        });
    };

    return (
        <article
            className={`${
                depth > 0 ? "ml-10 border-l-2 border-border pl-4" : ""
            } ${comment.is_hidden ? "opacity-50" : ""}`}
        >
            <div className="flex items-start gap-3">
                <CommentAvatar author={comment.author} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium leading-tight">
                            {comment.author.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {formatRelative(comment.created_at)}
                            {comment.edited_at && (
                                <span className="italic"> · modifié</span>
                            )}
                            {comment.is_hidden && (
                                <span className="ml-2 text-destructive uppercase text-[10px] tracking-wide">
                  Masqué
                </span>
                            )}
                        </p>
                    </div>

                    {editing ? (
                        <CommentEditForm
                            comment={comment}
                            onCancel={() => setEditing(false)}
                            onSuccess={() => {
                                setEditing(false);
                                router.refresh();
                            }}
                        />
                    ) : (
                        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">
                            {comment.content}
                        </p>
                    )}

                    {!editing && (
                        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                            <button
                                type="button"
                                onClick={onLike}
                                disabled={isPending}
                                className={`transition-colors ${
                                    liked
                                        ? "text-destructive"
                                        : "text-muted-foreground hover:text-foreground"
                                } disabled:opacity-50`}
                            >
                                {liked ? "❤" : "♡"} {likesCount}
                            </button>
                            {isLoggedIn && depth === 0 && (
                                <button
                                    type="button"
                                    onClick={() => setReplying(!replying)}
                                    className="uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {replying ? "Annuler" : "Répondre"}
                                </button>
                            )}
                            {comment.is_my_comment && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setEditing(true)}
                                        className="uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Éditer
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onDelete}
                                        disabled={isPending}
                                        className="uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                                    >
                                        Supprimer
                                    </button>
                                </>
                            )}
                            {comment.can_hide && !comment.is_my_comment && (
                                <button
                                    type="button"
                                    onClick={onHide}
                                    disabled={isPending}
                                    className="uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                                >
                                    Masquer
                                </button>
                            )}
                        </div>
                    )}

                    {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

                    {replying && (
                        <div className="mt-3">
                            <CommentComposer
                                postId={postId}
                                parentId={comment.id}
                                onCancel={() => setReplying(false)}
                                onSuccess={() => setReplying(false)}
                                autoFocus
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Réponses */}
            {comment.replies.length > 0 && (
                <ul className="mt-4 space-y-4">
                    {comment.replies.map((r) => (
                        <li key={r.id}>
                            <CommentItem
                                comment={r}
                                postId={postId}
                                isLoggedIn={isLoggedIn}
                                depth={depth + 1}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </article>
    );
}

function CommentComposer({
                             postId,
                             parentId,
                             onCancel,
                             onSuccess,
                             autoFocus,
                         }: {
    postId: string;
    parentId: string | null;
    onCancel?: () => void;
    onSuccess?: () => void;
    autoFocus?: boolean;
}) {
    const router = useRouter();
    const [content, setContent] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!content.trim()) {
            setError("Le commentaire ne peut pas être vide.");
            return;
        }
        setError(null);

        const fd = new FormData();
        fd.set("post_id", postId);
        if (parentId) fd.set("parent_id", parentId);
        fd.set("content", content);

        startTransition(async () => {
            const r = await createCommentAction(fd);
            if (r.ok) {
                setContent("");
                router.refresh();
                onSuccess?.();
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-2">
      <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={2000}
          autoFocus={autoFocus}
          placeholder={parentId ? "Ta réponse..." : "Ton commentaire..."}
          className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
      />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={isPending || !content.trim()}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-4 py-2 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending ? "Envoi..." : "Publier"}
                </button>
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Annuler
                    </button>
                )}
            </div>
        </form>
    );
}

function CommentEditForm({
                             comment,
                             onCancel,
                             onSuccess,
                         }: {
    comment: CommentTreeItem;
    onCancel: () => void;
    onSuccess: () => void;
}) {
    const [content, setContent] = useState(comment.content);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!content.trim()) return;
        setError(null);

        const fd = new FormData();
        fd.set("comment_id", comment.id);
        fd.set("content", content);

        startTransition(async () => {
            const r = await updateCommentAction(fd);
            if (r.ok) onSuccess();
            else setError(r.error);
        });
    };

    return (
        <form onSubmit={onSubmit} className="mt-2 space-y-2">
      <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={2000}
          autoFocus
          className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
      />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-4 py-2 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending ? "..." : "Enregistrer"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}

function CommentAvatar({
                           author,
                       }: {
    author: { name: string; avatar_url: string | null };
}) {
    if (author.avatar_url) {
        return (
            <div className="w-9 h-9 relative bg-secondary border border-border overflow-hidden shrink-0">
                <Image
                    src={author.avatar_url}
                    alt={author.name}
                    fill
                    sizes="36px"
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
        <div className="w-9 h-9 flex items-center justify-center bg-accent/10 text-accent text-[10px] font-medium uppercase tracking-wide shrink-0">
            {initials || "?"}
        </div>
    );
}

function formatRelative(d: string): string {
    const date = new Date(d);
    const now = new Date();
    const diffMin = Math.round((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 24) return `il y a ${diffHour} h`;
    const diffDay = Math.round(diffHour / 24);
    if (diffDay < 7) return `il y a ${diffDay} j`;
    return date.toLocaleDateString("fr-BE", {
        day: "numeric",
        month: "short",
    });
}