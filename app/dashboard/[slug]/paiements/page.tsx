import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import { StripeOnboardingPanel } from "@/components/sente/stripe-onboarding-panel";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ onboarding?: string }>;

export default async function PaiementsPage({
                                                params,
                                                searchParams,
                                            }: {
    params: Params;
    searchParams: SearchParams;
}) {
    const { slug } = await params;
    const sp = await searchParams;
    const ctx = await getDashboardContext(slug);

    const supabase = await createClient();
    const { data: org } = await supabase
        .from("organizations")
        .select(
            `id, name, country, stripe_account_id, stripe_onboarded,
             stripe_charges_enabled, stripe_payouts_enabled, org_type,
             etang_details(commission_rate_bps),
             magasin_details(commission_rate_bps, plan)`
        )
        .eq("id", ctx.org.id)
        .single();

    if (!org) return null;

    // Récupère la commission selon le type d'org.
    // Supabase peut retourner un objet ou un array selon le typage : on gère les deux.
    const commissionBps =
        org.org_type === "etang"
            ? (Array.isArray(org.etang_details)
            ? org.etang_details[0]?.commission_rate_bps
            : (org.etang_details as { commission_rate_bps?: number } | null)
                ?.commission_rate_bps) ?? 300
            : (Array.isArray(org.magasin_details)
            ? org.magasin_details[0]?.commission_rate_bps
            : (org.magasin_details as { commission_rate_bps?: number } | null)
                ?.commission_rate_bps) ?? 500;

    const justCompleted = sp.onboarding === "complete";
    const justRefreshed = sp.onboarding === "refresh";

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Paiements
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Encaisser via Sente
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Configure ton compte Stripe pour encaisser les abonnements pêcheurs
                    en ligne directement sur ta fiche. Sente prélève une commission de{" "}
                    {(commissionBps / 100).toFixed(2)}% sur chaque paiement, le reste
                    arrive sur ton compte sous 7 jours.
                </p>
            </div>

            {justCompleted && (
                <div className="border border-primary/30 bg-primary/5 px-5 py-4 text-sm">
                    Configuration Stripe terminée. Patiente quelques secondes que Stripe
                    valide ton compte, puis clique sur « Rafraîchir le statut ».
                </div>
            )}
            {justRefreshed && (
                <div className="border border-accent/30 bg-accent/5 px-5 py-4 text-sm">
                    Tu peux reprendre la configuration Stripe en cliquant ci-dessous.
                </div>
            )}

            <StripeOnboardingPanel
                orgId={org.id}
                hasAccount={!!org.stripe_account_id}
                isOnboarded={org.stripe_onboarded}
                chargesEnabled={org.stripe_charges_enabled}
                payoutsEnabled={org.stripe_payouts_enabled}
                commissionBps={commissionBps}
            />
        </div>
    );
}