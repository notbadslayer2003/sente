import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHybridFeed, getHybridFeedFollowing } from "@/lib/dal/feed-hybrid";
import { getMyOrgs } from "@/lib/dal/posts";
import { FeedClient } from "@/components/sente/feed-client";

type SearchParams = Promise<{ tab?: string }>;

export default async function FeedPage({
                                           searchParams,
                                       }: {
    searchParams: SearchParams;
}) {
    const sp = await searchParams;
    const tab: "discover" | "following" =
        sp.tab === "following" ? "following" : "discover";

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (tab === "following" && !user) {
        redirect("/login?next=/feed");
    }

    const [items, myOrgs] = await Promise.all([
        tab === "following" && user
            ? getHybridFeedFollowing({ user_id: user.id, limit: 30 })
            : getHybridFeed({ limit: 30 }),
        user ? getMyOrgs() : Promise.resolve([]),
    ]);

    return (
        <section className="bg-background min-h-screen pt-24 pb-16">
            <div className="mx-auto max-w-2xl px-6 sm:px-8">
                <div className="mb-8">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Communauté
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                        Le fil.
                    </h1>
                </div>

                <FeedClient
                    initialItems={items}
                    activeTab={tab}
                    isLoggedIn={!!user}
                    currentUserId={user?.id ?? null}
                    myOrgs={myOrgs}
                />
            </div>
        </section>
    );
}