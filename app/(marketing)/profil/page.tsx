import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type SearchParams = Promise<{ org_creation_failed?: string }>;

export default async function ProfilPage({
                                             searchParams,
                                         }: {
    searchParams: SearchParams;
}) {
    const params = await searchParams;
    const orgFailed = params.org_creation_failed === "1";

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    const { data: memberships } = await supabase
        .from("memberships")
        .select(
            "role, organization:organizations(id, slug, name, org_type, status)"
        )
        .eq("user_id", user.id)
        .not("accepted_at", "is", null);

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Mon profil
                </p>
                <h1 className="mt-3 font-display-soft text-5xl tracking-tight">
                    Bienvenue {profile?.full_name?.split(" ")[0] ?? "pêcheur"}.
                </h1>
                <p className="mt-6 text-muted-foreground">
                    Connecté en tant que <strong>{user.email}</strong>.
                </p>

                {orgFailed && (
                    <div className="mt-8 border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm">
                        <p className="font-medium text-destructive">
                            La création de votre organisation a échoué.
                        </p>
                        <p className="mt-1 text-muted-foreground">
                            Contactez-nous depuis la page Contact, on règle ça rapidement.
                        </p>
                    </div>
                )}

                {memberships && memberships.length > 0 && (
                    <div className="mt-12">
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Mes organisations
                        </p>
                        <ul className="mt-4 divide-y divide-border border-y border-border">
                            {memberships.map((m) => {
                                const org = m.organization;
                                if (!org) return null;
                                return (
                                    <li
                                        key={org.id}
                                        className="py-4 flex items-center justify-between gap-4"
                                    >
                                        <div>
                                            <p className="font-display text-lg leading-tight">
                                                {org.name}
                                            </p>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
                                                {org.org_type === "etang" ? "Étang" : "Magasin"} ·{" "}
                                                {org.status} · rôle : {m.role}
                                            </p>
                                        </div>
                                        <Link
                                            href={`/dashboard/${org.slug}`}
                                            className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                        >
                                            Gérer →
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                <details className="mt-12 text-xs">
                    <summary className="cursor-pointer text-muted-foreground uppercase tracking-wide">
                        Profile data (debug)
                    </summary>
                    <pre className="mt-4 bg-secondary/30 border border-border p-6 text-xs overflow-auto">
                        {JSON.stringify(profile, null, 2)}
                    </pre>
                </details>
            </div>
        </section>
    );
}