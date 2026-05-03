"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedPost } from "@/lib/dal/posts";
import { PostCard } from "@/components/sente/post-card";
import { PostComposer } from "@/components/sente/post-composer";

type MyOrg = { id: string; name: string; slug: string; org_type: string };

export function FeedClient({
                               initialPosts,
                               activeTab,
                               isLoggedIn,
                               currentUserId,
                               myOrgs,
                           }: {
    initialPosts: FeedPost[];
    activeTab: "discover" | "following";
    isLoggedIn: boolean;
    currentUserId: string | null;
    myOrgs: MyOrg[];
}) {
    const router = useRouter();
    const [composerOpen, setComposerOpen] = useState(false);

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-border">
                <TabLink
                    label="Découverte"
                    active={activeTab === "discover"}
                    onClick={() => router.push("/feed")}
                />
                {isLoggedIn && (
                    <TabLink
                        label="Suivi"
                        active={activeTab === "following"}
                        onClick={() => router.push("/feed?tab=following")}
                    />
                )}
            </div>

            {/* Composer inline pour les users loggés */}
            {isLoggedIn && (
                <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="w-full text-left border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors px-5 py-4 text-sm text-muted-foreground"
                >
                    Quoi de neuf au bord de l&apos;eau ?
                </button>
            )}

            {/* Posts */}
            {initialPosts.length === 0 ? (
                <div className="border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        {activeTab === "following"
                            ? "Tu ne suis encore aucun étang. Va sur une fiche pour suivre."
                            : "Aucun post pour le moment. Sois le premier."}
                    </p>
                </div>
            ) : (
                <ul className="space-y-6">
                    {initialPosts.map((p) => (
                        <li key={p.id}>
                            <PostCard post={p} currentUserId={currentUserId} initialLiked={p.is_liked_by_me} />
                        </li>
                    ))}
                </ul>
            )}

            {/* CTA en bas pour pagination future */}
            {initialPosts.length >= 20 && (
                <div className="text-center pt-6">
                    <p className="text-xs text-muted-foreground">
                        Pagination en scroll infini prochainement.
                    </p>
                </div>
            )}

            {/* Bouton flottant + modal composer */}
            {isLoggedIn && (
                <>
                    <button
                        type="button"
                        onClick={() => setComposerOpen(true)}
                        aria-label="Nouveau post"
                        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-accent text-accent-foreground hover:bg-accent/90 transition-colors flex items-center justify-center text-2xl shadow-lg"
                    >
                        +
                    </button>
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
                </>
            )}

            {!isLoggedIn && (
                <div className="border border-border bg-secondary/30 p-6 text-center text-sm">
                    <Link
                        href="/login?next=/feed"
                        className="text-accent hover:text-accent/80 transition-colors uppercase tracking-wide"
                    >
                        Connecte-toi
                    </Link>{" "}
                    pour publier.
                </div>
            )}
        </div>
    );
}

function TabLink({
                     label,
                     active,
                     onClick,
                 }: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`pb-3 text-sm uppercase tracking-wide transition-colors border-b-2 ${
                active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
            {label}
        </button>
    );
}