import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type SearchParams = Promise<{
    org_creation_failed?: string;
    org_limit?: string; // ← nouveau
}>;

const ORG_LIMIT = 5;

export default async function ProfilPage({
                                             searchParams,
                                         }: {
    searchParams: SearchParams;
}) {
    const params = await searchParams;
    const orgFailed = params.org_creation_failed === "1";
    const orgLimit = params.org_limit === "1";

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
        .select("role, organization:organizations(id, slug, name, org_type, status)")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null);

    const firstName = profile?.full_name?.split(" ")[0] ?? "pêcheur";

    const orgCount = memberships?.length ?? 0;
    const canCreateMore = orgCount < ORG_LIMIT;

    return (
        <section className="bg-background min-h-screen pb-24">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12 space-y-16">

                {/* En-tête */}
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Mon profil
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl tracking-tight">
                        Bonjour, {firstName}.
                    </h1>
                </div>

                {/* Erreur création org */}
                {orgFailed && (
                    <div className="border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm">
                        <p className="font-medium text-destructive">
                            La création de votre organisation a échoué.
                        </p>
                        <p className="mt-1 text-muted-foreground">
                            Contactez-nous depuis la page Contact, on règle ça rapidement.
                        </p>
                    </div>
                )}

                {orgLimit && (
                    <div className="border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm">
                        <p className="font-medium text-destructive">
                            Limite atteinte (5 organisations max par compte).
                        </p>
                        <p className="mt-1 text-muted-foreground">
                            Contacte le support si tu as un cas spécifique.
                        </p>
                    </div>
                )}

                {/* Compte */}
                <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Compte
                    </p>
                    <div className="border border-border divide-y divide-border">
                        <Row label="Adresse e-mail" value={user.email ?? "—"} />
                        <Row
                            label="Nom complet"
                            value={profile?.full_name ?? "Non renseigné"}
                        />
                        <Row
                            label="Membre depuis"
                            value={new Date(user.created_at).toLocaleDateString("fr-BE", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                            })}
                        />
                    </div>
                    <div className="flex gap-4">
                        <Link
                            href="/profil/parametres"
                            className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                        >
                            Modifier mes informations
                        </Link>
                        {/*<Link*/}
                        {/*    href="/profil/mot-de-passe"*/}
                        {/*    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"*/}
                        {/*>*/}
                        {/*    Changer mon mot de passe*/}
                        {/*</Link>*/}
                    </div>
                </div>

                {memberships && memberships.length > 0 ? (
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Mes organisations
                        </p>
                        <ul className="border-y border-border divide-y divide-border">
                            {memberships.map((m) => {
                                const org = m.organization;
                                if (!org) return null;
                                const typeLabel =
                                    org.org_type === "etang" ? "Étang" : "Magasin";
                                const statusLabel: Record<string, string> = {
                                    active: "Active",
                                    draft: "Brouillon",
                                    pending_review: "En attente de validation",
                                    suspended: "Suspendue",
                                };
                                const roleLabel: Record<string, string> = {
                                    owner: "Propriétaire",
                                    admin: "Admin",
                                    staff: "Staff",
                                };
                                return (
                                    <li
                                        key={org.id}
                                        className="py-5 flex items-center justify-between gap-4"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-display text-lg leading-tight truncate">
                                                {org.name}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {typeLabel} · {statusLabel[org.status] ?? org.status} ·{" "}
                                                {roleLabel[m.role] ?? m.role}
                                            </p>
                                        </div>
                                        <Link
                                            href={`/dashboard/${org.slug}`}
                                            className="shrink-0 text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                        >
                                            Tableau de bord →
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>

                        {/* CTAs d'ajout — visibles tant que limite pas atteinte */}
                        {canCreateMore && (
                            <div className="flex flex-wrap gap-6 pt-2">
                                <Link
                                    href="/inscrire-etang"
                                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                >
                                    + Inscrire un étang
                                </Link>
                                <Link
                                    href="/inscrire-magasin"
                                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                >
                                    + Inscrire un magasin
                                </Link>
                                <p className="ml-auto text-xs text-muted-foreground">
                                    {orgCount} / {ORG_LIMIT} organisations
                                </p>
                            </div>
                        )}

                        {!canCreateMore && (
                            <p className="text-xs text-muted-foreground pt-2">
                                Limite atteinte ({ORG_LIMIT} organisations max).
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Mes organisations
                        </p>
                        <div className="border border-dashed border-border px-6 py-10 text-center space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Tu n&apos;es encore associé à aucune organisation.
                            </p>
                            <div className="flex justify-center gap-6">
                                <Link
                                    href="/inscrire-etang"
                                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                >
                                    Inscrire un étang
                                </Link>
                                <Link
                                    href="/inscrire-magasin"
                                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                >
                                    Inscrire un magasin
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* Commandes */}
                <div className="space-y-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Mes achats
                    </p>
                    <div className="border border-border px-5 py-4 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            Retrouve l'historique de tes commandes en boutique.
                        </p>
                        <Link
                            href="/profil/commandes"
                            className="shrink-0 text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                        >
                            Voir mes commandes →
                        </Link>
                    </div>
                </div>

            </div>
        </section>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="px-5 py-4 flex items-center justify-between gap-4">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {label}
            </span>
            <span className="text-sm text-right">{value}</span>
        </div>
    );
}