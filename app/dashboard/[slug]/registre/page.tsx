import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { canAccessRegistre } from "@/lib/dal/feature-gate";
import { RegistreManager } from "@/components/sente/registre-manager";
import { UpgradeBlock } from "@/components/sente/upgrade-block";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ year?: string }>;

export default async function RegistrePage({
                                               params,
                                               searchParams,
                                           }: {
    params: Params;
    searchParams: SearchParams;
}) {
    const { slug } = await params;
    const sp = await searchParams;
    const ctx = await getDashboardContext(slug);

    if (ctx.org.org_type !== "etang") redirect(`/dashboard/${slug}`);

    // Feature gating : registre réservé au plan CRM
    const access = await canAccessRegistre(ctx.org.id);
    if (!access.ok) {
        return (
            <UpgradeBlock
                slug={slug}
                featureName="Registre des pêcheurs"
                requiredPlan={access.requiredPlan!}
                description="Gère tes pêcheurs annuels avec un CRM dédié : ajout manuel, paiements en ligne, suivi des statuts, exports comptables."
            />
        );
    }

    const supabase = await createClient();

    const currentYear = new Date().getFullYear();
    const selectedYear = sp.year
        ? parseInt(sp.year, 10) || currentYear
        : currentYear;

    // Charger en parallèle : abonnements de la saison + postes actifs + années dispo
    const [{ data: subs }, { data: postes }, { data: years }] = await Promise.all([
        supabase
            .from("pecheur_subscriptions")
            .select(
                `id, pecheur_full_name, pecheur_email, pecheur_phone,
                 saison_year, period_type, start_date, end_date, poste_id,
                 price_cents, paid_amount_cents, payment_method, payment_status,
                 paid_at, notes, created_at,
                 poste:postes(id, numero, label)`
            )
            .eq("etang_id", ctx.org.id)
            .eq("saison_year", selectedYear)
            .order("pecheur_full_name", { ascending: true }),
        supabase
            .from("postes")
            .select("id, numero, label")
            .eq("etang_id", ctx.org.id)
            .eq("active", true)
            .order("numero", { ascending: true }),
        supabase
            .from("pecheur_subscriptions")
            .select("saison_year")
            .eq("etang_id", ctx.org.id),
    ]);

    // Liste unique des années où il y a au moins un abonnement
    const availableYears = Array.from(
        new Set([...(years?.map((y) => y.saison_year) ?? []), currentYear])
    ).sort((a, b) => b - a);

    // Stats pour la saison courante
    const subsList = subs ?? [];
    const totalCount = subsList.length;
    const paidCount = subsList.filter((s) => s.payment_status === "paid").length;
    const pendingCount = subsList.filter(
        (s) => s.payment_status === "pending" || s.payment_status === "partial"
    ).length;
    const totalRevenueCents = subsList.reduce(
        (sum, s) => sum + s.paid_amount_cents,
        0
    );

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    CRM
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Registre pêcheurs
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Tous les pêcheurs abonnés à ton étang. Ajoute-les manuellement
                    (paiement cash/virement/chèque) ou ils s&apos;ajoutent
                    automatiquement quand ils paient en ligne.
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Total saison" value={totalCount.toString()} />
                <StatCard label="Payés" value={paidCount.toString()} />
                <StatCard label="En attente" value={pendingCount.toString()} />
                <StatCard
                    label="Encaissé"
                    value={`${(totalRevenueCents / 100).toFixed(0)} €`}
                />
            </div>

            <RegistreManager
                etangId={ctx.org.id}
                slug={ctx.org.slug}
                selectedYear={selectedYear}
                availableYears={availableYears}
                postes={postes ?? []}
                subscriptions={
                    subsList.map((s) => ({
                        id: s.id,
                        pecheur_full_name: s.pecheur_full_name,
                        pecheur_email: s.pecheur_email,
                        pecheur_phone: s.pecheur_phone,
                        saison_year: s.saison_year,
                        period_type: s.period_type,
                        start_date: s.start_date,
                        end_date: s.end_date,
                        poste_id: s.poste_id,
                        poste_label: (() => {
                            const p = Array.isArray(s.poste) ? s.poste[0] : s.poste;
                            return p
                                ? `${p.numero}${p.label ? ` — ${p.label}` : ""}`
                                : null;
                        })(),
                        price_cents: s.price_cents,
                        paid_amount_cents: s.paid_amount_cents,
                        payment_method: s.payment_method,
                        payment_status: s.payment_status,
                        notes: s.notes,
                    })) ?? []
                }
            />
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-border bg-secondary/20 p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
            </p>
            <p className="mt-2 font-display text-3xl tracking-tight">{value}</p>
        </div>
    );
}