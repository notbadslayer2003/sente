"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, PenLine } from "lucide-react";
import type { FeedItem } from "@/lib/dal/feed-hybrid";
import { PostCard } from "@/components/sente/post-card";
import { EventCard } from "@/components/sente/event-card";
import { PostComposer } from "@/components/sente/post-composer";

type MyOrg = { id: string; name: string; slug: string; org_type: string };

export function FeedClient({
                               initialItems,
                               activeTab,
                               isLoggedIn,
                               currentUserId,
                               myOrgs,
                           }: {
    initialItems: FeedItem[];
    activeTab: "discover" | "following";
    isLoggedIn: boolean;
    currentUserId: string | null;
    myOrgs: MyOrg[];
}) {
    const router = useRouter();
    const [composerOpen, setComposerOpen] = useState(false);

    return (
        <div className="space-y-0">

            {/* Header contextuel */}
            <div className="mb-8">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Communauté
                </p>
                <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                    {activeTab === "following" ? "Mes suivis." : "Le fil."}
                </h1>
                {activeTab === "discover" && (
                    <p className="mt-3 text-sm text-muted-foreground">
                        Prises, sessions, events — toute l&apos;actu de la communauté pêche.
                    </p>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-0 border-b border-border mb-6">
                <TabLink
                    label="Découverte"
                    active={activeTab === "discover"}
                    onClick={() => router.push("/feed")}
                />
                {isLoggedIn && (
                    <TabLink
                        label="Mes suivis"
                        active={activeTab === "following"}
                        onClick={() => router.push("/feed?tab=following")}
                    />
                )}
            </div>

            {/* Composer trigger */}
            {isLoggedIn && (
                <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="w-full mb-6 group border border-border hover:border-accent/50 bg-secondary/10 hover:bg-accent/5 transition-all p-4"
                >
                    <div className="flex items-center gap-3">
                        {/* Fake avatar */}
                        <div className="w-9 h-9 flex-shrink-0 bg-accent/10 border border-border" />
                        <div className="flex-1 text-left">
                            <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                Partage ta session, ta prise, ton bon plan...
                            </p>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground group-hover:text-accent transition-colors">
                            <Camera className="w-4 h-4" strokeWidth={1.75} />
                            <PenLine className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                    </div>
                </button>
            )}

            {/* CTA non connecté */}
            {!isLoggedIn && (
                <div className="mb-6 border border-border p-5 flex items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">
                        Rejoins la communauté pour publier et suivre des étangs.
                    </p>
                    <div className="flex gap-3 shrink-0">
                        <Link
                            href="/login?next=/feed"
                            className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                        >
                            Connexion
                        </Link>
                        <Link
                            href="/signup"
                            className="text-xs uppercase tracking-wide bg-accent text-accent-foreground px-3 py-1 hover:bg-accent/90 transition-colors"
                        >
                            S'inscrire
                        </Link>
                    </div>
                </div>
            )}

            {/* Feed */}
            {initialItems.length === 0 ? (
                <EmptyFeed tab={activeTab} isLoggedIn={isLoggedIn} />
            ) : (
                <ul className="space-y-5">
                    {initialItems.map((item) => (
                        <li key={item.kind === "post" ? `p-${item.post.id}` : `e-${item.event.id}`}>
                            {item.kind === "post" ? (
                                <PostCard
                                    post={item.post}
                                    currentUserId={currentUserId}
                                    initialLiked={item.post.is_liked_by_me}
                                />
                            ) : (
                                <EventCard event={item.event} />
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {/* FAB mobile */}
            {isLoggedIn && (
                <>
                    <button
                        type="button"
                        onClick={() => setComposerOpen(true)}
                        aria-label="Nouveau post"
                        className="fixed bottom-6 right-6 z-40 w-12 h-12 bg-accent text-accent-foreground hover:bg-accent/90 transition-colors flex items-center justify-center shadow-lg sm:hidden"
                    >
                        <PenLine className="w-5 h-5" strokeWidth={1.75} />
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
        </div>
    );
}

function EmptyFeed({
                       tab,
                       isLoggedIn,
                   }: {
    tab: "discover" | "following";
    isLoggedIn: boolean;
}) {
    if (tab === "following") {
        return (
            <div className="border border-dashed border-border p-12 text-center space-y-4">
                <p className="text-sm">Tu ne suis encore personne.</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Explore les fiches d'étangs et de magasins et clique sur "Suivre"
                    pour voir leur actu ici.
                </p>
                <div className="flex justify-center gap-4 pt-2">
                    <Link
                        href="/lieux"
                        className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                    >
                        Voir les étangs
                    </Link>
                    <Link
                        href="/magasins"
                        className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                    >
                        Voir les magasins
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="border border-dashed border-border p-12 text-center space-y-3">
            <p className="text-sm">Aucun contenu pour le moment.</p>
            {isLoggedIn ? (
                <p className="text-xs text-muted-foreground">
                    Sois le premier à partager une session.
                </p>
            ) : (
                <p className="text-xs text-muted-foreground">
                    <Link href="/signup" className="text-accent hover:underline">
                        Crée un compte
                    </Link>{" "}
                    pour être le premier à publier.
                </p>
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
            className={`px-4 pb-3 text-xs uppercase tracking-[0.15em] transition-colors border-b-2 -mb-px ${
                active
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
            {label}
        </button>
    );
}