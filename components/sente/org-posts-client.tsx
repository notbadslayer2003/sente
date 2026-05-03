"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { FeedPost } from "@/lib/dal/posts";
import { PostCard } from "@/components/sente/post-card";
import { PostComposer } from "@/components/sente/post-composer";

type MyOrg = { id: string; name: string; slug: string; org_type: string };

export function OrgPostsClient({
                                   orgId,
                                   orgName,
                                   myOrgs,
                                   posts,
                               }: {
    orgId: string;
    orgName: string;
    myOrgs: MyOrg[];
    posts: FeedPost[];
}) {
    const router = useRouter();
    const [composerOpen, setComposerOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-display text-xl tracking-tight">Tous les posts</h2>
                <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="inline-flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium"
                >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                    Nouveau post
                </button>
            </div>

            {posts.length === 0 ? (
                <div className="border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                        Aucun post publié pour le moment.
                    </p>
                    <button
                        type="button"
                        onClick={() => setComposerOpen(true)}
                        className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                    >
                        Publier le premier →
                    </button>
                </div>
            ) : (
                <ul className="space-y-6">
                    {posts.map((p) => (
                        <li key={p.id}>
                            <PostCard
                                post={p}
                                currentUserId={null /* on cache le bouton suivre */}
                                initialLiked={p.is_liked_by_me}
                                canDelete={true}
                            />
                        </li>
                    ))}
                </ul>
            )}

            {composerOpen && (
                <PostComposer
                    myOrgs={myOrgs}
                    onClose={() => setComposerOpen(false)}
                    onSuccess={() => {
                        setComposerOpen(false);
                        router.refresh();
                    }}
                />
            )}
        </div>
    );
}