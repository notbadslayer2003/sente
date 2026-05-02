import { createClient } from "@/lib/supabase/server";
import { ApproveRejectButtons } from "@/components/sente/approve-reject-buttons";

export default async function AdminOrgsPage() {
    const supabase = await createClient();

    const { data: pending } = await supabase
        .from("organizations")
        .select("id, slug, name, org_type, country, region, city, status, created_at, owner_user_id")
        .eq("status", "pending_review")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

    const { data: active } = await supabase
        .from("organizations")
        .select("id, slug, name, org_type, country, status, created_at")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Modération
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Organisations
                </h1>
            </div>

            <section>
                <h2 className="font-display text-xl tracking-tight">
                    En attente de validation ({pending?.length ?? 0})
                </h2>
                <div className="mt-6">
                    {!pending || pending.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucune org en attente.</p>
                    ) : (
                        <ul className="divide-y divide-border border-y border-border">
                            {pending.map((o) => (
                                <li key={o.id} className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                    <div className="md:col-span-7">
                                        <p className="font-display text-lg leading-tight">{o.name}</p>
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground mt-1">
                                            {o.org_type} · {o.country} · {o.region ?? "—"} · {o.city ?? "—"}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Créée : {new Date(o.created_at).toLocaleString("fr-BE")}
                                        </p>
                                        <a
                                        href={
                                        o.org_type === "etang"
                                            ? `/lieux/${o.slug}`
                                            : `/magasins/${o.slug}`
                                    }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-block text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                        >
                                        Aperçu fiche →
                                    </a>
                                </div>
                                <div className="md:col-span-5">
                                <ApproveRejectButtons orgId={o.id} />
                        </div>
                        </li>
                        ))}
                </ul>
                )}
        </div>
</section>

    <section className="border-t border-border pt-12">
        <h2 className="font-display text-xl tracking-tight">
            Récemment activées ({active?.length ?? 0})
        </h2>
        <div className="mt-6">
            {!active || active.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune org active.</p>
            ) : (
                <ul className="divide-y divide-border border-y border-border text-sm">
                    {active.map((o) => (
                        <li key={o.id} className="py-3 flex items-center justify-between gap-4">
                                    <span>
                                        <strong>{o.name}</strong>{" "}
                                        <span className="text-muted-foreground">
                                            ({o.org_type} · {o.country})
                                        </span>
                                    </span>
                            <span className="text-xs text-muted-foreground">
                                        {new Date(o.created_at).toLocaleDateString("fr-BE")}
                                    </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    </section>
</div>
);
}