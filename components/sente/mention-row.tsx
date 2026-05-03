"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeOrgMentionAction } from "@/app/actions/mentions";

export type MentionItem = {
    post_id: string;
    organization_id: string;
    content: string;
    photo_url: string | null;
    created_at: string;
    author_name: string;
    author_avatar: string | null;
};

export function MentionRow({ mention }: { mention: MentionItem }) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [removed, setRemoved] = useState(false);

    const onRemove = () => {
        if (
            !confirm(
                "Retirer cette mention ? L'auteur du post ne sera pas notifié, mais le tag disparaîtra de son post."
            )
        )
            return;
        setError(null);
        const fd = new FormData();
        fd.set("post_id", mention.post_id);
        fd.set("organization_id", mention.organization_id);
        startTransition(async () => {
            const r = await removeOrgMentionAction(fd);
            if (r.ok) {
                setRemoved(true);
                setTimeout(() => router.refresh(), 600);
            } else {
                setError(r.error);
            }
        });
    };

    if (removed) return null;

    return (
        <article className="border border-border bg-secondary/10 p-5 flex items-start gap-4">
            {mention.photo_url ? (
                <div className="w-20 h-20 relative bg-background border border-border overflow-hidden shrink-0">
                    <Image
                        src={mention.photo_url}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                    />
                </div>
            ) : null}

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium leading-tight">
                        {mention.author_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {new Date(mention.created_at).toLocaleString("fr-BE", {
                            dateStyle: "short",
                            timeStyle: "short",
                        })}
                    </p>
                </div>
                <p className="mt-2 text-sm leading-relaxed line-clamp-3">
                    {mention.content}
                </p>
                <div className="mt-3 flex items-center gap-3">
                    <Link
                        href={`/post/${mention.post_id}`}
                        target="_blank"
                        className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                    >
                        Voir le post →
                    </Link>
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                        {isPending ? "..." : "Retirer la mention"}
                    </button>
                </div>
                {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            </div>
        </article>
    );
}