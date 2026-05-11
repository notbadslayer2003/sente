import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilSuivisPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login?next=/profil/suivis");
    }

    const { data: follows } = await supabase
        .from("follows")
        .select(
            `
            created_at,
            organization:organizations!target_org_id(
                id, slug, name, org_type, city, cover_image_url, status, deleted_at, followers_count
            )
        `
        )
        .eq("follower_user_id", user.id)
        .order("created_at", { ascending: false });

    type FollowedOrg = {
        id: string;
        slug: string;
        name: string;
        org_type: string;
        city: string | null;
        cover_image_url: string | null;
        followers_count: number;
        followed_at: string;
    };

    const followed: FollowedOrg[] = (follows ?? [])
        .map((f) => {
            const o = Array.isArray(f.organization) ? f.organization[0] : f.organization;
            if (!o || o.status !== "active" || o.deleted_at) return null;
            return {
                id: o.id,
                slug: o.slug,
                name: o.name,
                org_type: o.org_type,
                city: o.city,
                cover_image_url: o.cover_image_url,
                followers_count: o.followers_count,
                followed_at: f.created_at,
            };
        })
        .filter((o): o is FollowedOrg => o !== null);

    return (
        <section className="bg-background min-h-screen pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8">
                <div className="mb-10">
                    <Link
                        href="/profil"
                        className="inline-block text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                        ← Profil
                    </Link>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Mes suivis
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                        Tes étangs et magasins.
                    </h1>
                </div>

                {followed.length === 0 ? (
                    <div className="border border-dashed border-border p-12 text-center">
                        <p className="text-sm text-muted-foreground mb-4">
                            Tu ne suis encore aucun étang ou magasin.
                        </p>
                        <Link
                            href="/lieux"
                            className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                        >
                            Découvrir des étangs →
                        </Link>
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {followed.map((o) => (
                            <li key={o.id}>
                                <Link
                                    href={
                                        o.org_type === "etang"
                                            ? `/lieux/${o.slug}`
                                            : `/magasins/${o.slug}`
                                    }
                                    className="flex items-center gap-4 border border-border bg-secondary/10 hover:bg-secondary/30 transition-colors p-4"
                                >
                                    <div className="w-16 h-16 relative bg-secondary border border-border overflow-hidden shrink-0">
                                        {o.cover_image_url ? (
                                            <Image
                                                src={o.cover_image_url}
                                                alt={o.name}
                                                fill
                                                sizes="64px"
                                                className="object-cover"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
                                                {o.org_type === "etang" ? "Étang" : "Magasin"}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-display text-base leading-tight">
                                            {o.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {o.org_type === "etang" ? "Étang" : "Magasin"}
                                            {o.city && ` · ${o.city}`}
                                        </p>
                                        {o.followers_count > 0 && (
                                            <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                                                {o.followers_count}{" "}
                                                {o.followers_count > 1 ? "abonnés" : "abonné"}
                                            </p>
                                        )}
                                    </div>
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                        →
                                      </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}