import { getDashboardContext } from "@/lib/dal/dashboard";
import { getPostsByOrg, getMyOrgs } from "@/lib/dal/posts";
import { OrgPostsClient } from "@/components/sente/org-posts-client";

type Params = Promise<{ slug: string }>;

export default async function OrgPostsPage({ params }: { params: Params }) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    const [posts, myOrgs] = await Promise.all([
        getPostsByOrg(ctx.org.id),
        getMyOrgs(),
    ]);

    // Stats agrégées
    const totalLikes = posts.reduce((sum, p) => sum + p.likes_count, 0);
    const totalComments = posts.reduce((sum, p) => sum + p.comments_count, 0);

    return (
        <div className="space-y-10">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Communauté
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Posts de {ctx.org.name}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground max-w-xl">
                    Partage des actualités, des photos de prises ou des annonces avec la
                    communauté. Tes posts apparaissent dans le fil de tes abonnés et sur ta fiche
                    publique.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md">
                <Stat label="Posts publiés" value={posts.length.toString()} />
                <Stat label="Likes reçus" value={totalLikes.toString()} />
                <Stat label="Commentaires" value={totalComments.toString()} />
            </div>

            <OrgPostsClient
                orgId={ctx.org.id}
                orgName={ctx.org.name}
                myOrgs={myOrgs}
                posts={posts}
            />
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-border bg-secondary/20 p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
            </p>
            <p className="mt-2 font-display text-2xl tracking-tight tabular-nums">{value}</p>
        </div>
    );
}