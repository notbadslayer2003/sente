import Link from "next/link";
import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { StripeOnboardingPanel } from "@/components/sente/stripe-onboarding-panel";
import { PaiementsHistoryView } from "@/components/sente/paiements-history-view";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ onboarding?: string; tab?: string }>;

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

    const validTabs = ["config", "historique"] as const;
    type Tab = (typeof validTabs)[number];
    const tab: Tab = (validTabs as readonly string[]).includes(sp.tab ?? "config")
        ? ((sp.tab ?? "config") as Tab)
        : "config";

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

    // Fetch données historique uniquement si onglet actif
    let payments: Array<{
        id: string;
        kind: string;
        amount_cents: number;
        sente_commission_cents: number;
        status: string;
        created_at: string;
        reference_id: string | null;
        stripe_refund_id: string | null;
    }> = [];
    let stripeBalance: { available: number; pending: number } | null = null;

    if (tab === "historique") {
        const { data: paymentsData } = await supabase
            .from("payments")
            .select(
                "id, kind, amount_cents, sente_commission_cents, status, created_at, reference_id, stripe_refund_id"
            )
            .eq("recipient_org_id", ctx.org.id)
            .order("created_at", { ascending: false })
            .limit(50);

        payments = paymentsData ?? [];

        if (org.stripe_account_id && org.stripe_charges_enabled) {
            try {
                const stripe = getStripeClient();
                const balance = await stripe.balance.retrieve(
                    {},
                    { stripeAccount: org.stripe_account_id }
                );
                const eurAvailable =
                    balance.available.find((b) => b.currency === "eur")?.amount ?? 0;
                const eurPending =
                    balance.pending.find((b) => b.currency === "eur")?.amount ?? 0;
                stripeBalance = {
                    available: eurAvailable,
                    pending: eurPending,
                };
            } catch (err) {
                console.error("Stripe balance fetch failed:", err);
            }
        }
    }

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Paiements
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    {tab === "historique" ? "Historique" : "Encaisser via Sente"}
                </h1>
                {tab === "config" && (
                    <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                        Configure ton compte Stripe pour encaisser les paiements en
                        ligne directement sur ta fiche. Sente prélève une commission de{" "}
                        {(commissionBps / 100).toFixed(2)}% sur chaque paiement, le reste
                        arrive sur ton compte sous 7 jours.
                    </p>
                )}
            </div>

            {/* Onglets */}
            <div className="flex gap-1 border-b border-border">
                <TabLink
                    href={`/dashboard/${slug}/paiements`}
                    active={tab === "config"}
                    label="Configuration"
                />
                <TabLink
                    href={`/dashboard/${slug}/paiements?tab=historique`}
                    active={tab === "historique"}
                    label="Historique"
                />
            </div>

            {/* Banners conditionnelles (config seulement) */}
            {tab === "config" && justCompleted && (
                <div className="border border-primary/30 bg-primary/5 px-5 py-4 text-sm">
                    Configuration Stripe terminée. Patiente quelques secondes que Stripe
                    valide ton compte, puis clique sur « Rafraîchir le statut ».
                </div>
            )}
            {tab === "config" && justRefreshed && (
                <div className="border border-accent/30 bg-accent/5 px-5 py-4 text-sm">
                    Tu peux reprendre la configuration Stripe en cliquant ci-dessous.
                </div>
            )}

            {/* Contenu de l'onglet */}
            {tab === "config" ? (
                <StripeOnboardingPanel
                    orgId={org.id}
                    hasAccount={!!org.stripe_account_id}
                    isOnboarded={org.stripe_onboarded}
                    chargesEnabled={org.stripe_charges_enabled}
                    payoutsEnabled={org.stripe_payouts_enabled}
                    commissionBps={commissionBps}
                />
            ) : (
                <PaiementsHistoryView
                    payments={payments}
                    stripeBalance={stripeBalance}
                />
            )}
        </div>
    );
}

function TabLink({
                     href,
                     active,
                     label,
                 }: {
    href: string;
    active: boolean;
    label: string;
}) {
    return (
        <Link
            href={href}
            className={`px-4 py-2 text-xs uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                active
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
            {label}
        </Link>
    );
}