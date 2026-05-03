"use client";

import { useState, useTransition } from "react";
import { toggleFollowAction } from "@/app/actions/follows";

export function FollowButton({
                                 orgId,
                                 initialFollowing,
                                 initialFollowersCount,
                                 isLoggedIn,
                                 size = "default",
                                 tone = "light",
                             }: {
    orgId: string;
    initialFollowing: boolean;
    initialFollowersCount: number;
    isLoggedIn: boolean;
    size?: "default" | "sm";
    /** "light" = sur fond clair (défaut), "dark" = sur fond sombre type hero photo */
    tone?: "light" | "dark";
}) {
    const [following, setFollowing] = useState(initialFollowing);
    const [count, setCount] = useState(initialFollowersCount);
    const [isPending, startTransition] = useTransition();

    const onClick = () => {
        if (!isLoggedIn) {
            window.location.href =
                "/login?next=" + encodeURIComponent(window.location.pathname);
            return;
        }
        const prevFollowing = following;
        const prevCount = count;
        setFollowing(!following);
        setCount(following ? count - 1 : count + 1);

        const fd = new FormData();
        fd.set("target_org_id", orgId);
        startTransition(async () => {
            const r = await toggleFollowAction(fd);
            if (r.ok && r.data) {
                setFollowing(r.data.following);
                setCount(r.data.followers_count);
            } else {
                setFollowing(prevFollowing);
                setCount(prevCount);
            }
        });
    };

    const sizeClass =
        size === "sm" ? "px-3 py-1.5 text-[10px]" : "px-5 py-2.5 text-xs";

    // Variantes de couleurs selon le contexte
    const followingClass =
        tone === "dark"
            ? "border border-white/80 bg-transparent text-white hover:bg-destructive hover:border-destructive"
            : "border border-foreground bg-background text-foreground hover:bg-destructive hover:border-destructive hover:text-background";

    const notFollowingClass =
        "bg-accent text-accent-foreground hover:bg-accent/90";

    const countClass =
        tone === "dark" ? "text-white/85" : "text-muted-foreground";

    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={onClick}
                disabled={isPending}
                className={`${sizeClass} uppercase tracking-wide font-medium transition-colors disabled:opacity-50 ${
                    following ? followingClass : notFollowingClass
                }`}
            >
                {following ? (isPending ? "..." : "Suivi") : isPending ? "..." : "Suivre"}
            </button>
            {count > 0 && (
                <span className={`text-xs tabular-nums ${countClass}`}>
          {count} {count > 1 ? "abonnés" : "abonné"}
        </span>
            )}
        </div>
    );
}