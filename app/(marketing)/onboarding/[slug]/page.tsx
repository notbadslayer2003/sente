import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;

export default async function OnboardingPage({ params }: { params: Params }) {
    const { slug } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: org } = await supabase
        .from("organizations")
        .select("id, slug, name, org_type, status")
        .eq("slug", slug)
        .single();

    if (!org) notFound();

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .single();

    if (!membership) redirect("/profil");

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Bienvenue
                </p>
                <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                    {org.name}
                </h1>
                <p className="mt-6 text-base text-muted-foreground leading-relaxed">
                    Ton {org.org_type === "etang" ? "étang" : "magasin"} est créé. Il est
                    en statut <strong>{org.status}</strong>. La prochaine étape est de
                    compléter ta fiche pour que l&apos;équipe Sente puisse la valider.
                </p>

                <div className="mt-12 border border-border bg-secondary/30 p-8">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Prochaines étapes
                    </p>
                    <ul className="mt-4 space-y-3 text-sm">
                        <li className="flex gap-3">
                            <span className="mt-2 w-3 h-px bg-primary shrink-0" />
                            <span>Compléter la fiche (description, photos, contact)</span>
                        </li>
                        <li className="flex gap-3">
                            <span className="mt-2 w-3 h-px bg-primary shrink-0" />
                            <span>Inviter ton équipe (multi-utilisateurs)</span>
                        </li>
                        {org.org_type === "etang" && (
                            <li className="flex gap-3">
                                <span className="mt-2 w-3 h-px bg-primary shrink-0" />
                                <span>Configurer tes postes (optionnel)</span>
                            </li>
                        )}
                        {org.org_type === "magasin" && (
                            <li className="flex gap-3">
                                <span className="mt-2 w-3 h-px bg-primary shrink-0" />
                                <span>Choisir ton plan e-commerce (à partir de septembre)</span>
                            </li>
                        )}
                    </ul>
                </div>

                <div className="mt-12 flex flex-wrap gap-4 items-center">
                    <Link
                        href={`/dashboard/${org.slug}`}
                        className="inline-flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-7 py-3.5 text-sm font-medium tracking-wide uppercase"
                    >
                        Aller au dashboard
                    </Link>
                    <Link
                        href="/profil"
                        className="text-sm uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                    >
                        Mon profil
                    </Link>
                </div>
            </div>
        </section>
    );
}