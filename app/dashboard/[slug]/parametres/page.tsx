import { getDashboardContext } from "@/lib/dal/dashboard";
import { getOrgPlanInfo } from "@/lib/dal/plan";
import {
    ETANG_PLANS_LIST,
    MAGASIN_PLANS_LIST,
} from "@/lib/constants/plans";
import { PlanCardCompact } from "@/components/sente/plan-card-compact";
import { SubscriptionStatusBanner } from "@/components/sente/subscription-status-banner";
import { CustomerPortalButton } from "@/components/sente/customer-portal-button";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ upgraded?: string }>;

export default async function ParametresPage({
                                                 params,
                                                 searchParams,
                                             }: {
    params: Params;
    searchParams: SearchParams;
}) {
    const { slug } = await params;
    const sp = await searchParams;
    const ctx = await getDashboardContext(slug);
    const planInfo = await getOrgPlanInfo(ctx.org.id);

    if (!planInfo) {
        return (
            <div className="border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                Impossible de charger les paramètres du plan. Réessaie ou contacte le
                support.
            </div>
        );
    }

    const allPlans =
        planInfo.orgType === "etang" ? ETANG_PLANS_LIST : MAGASIN_PLANS_LIST;

    const justUpgraded = sp.upgraded === "1";

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Paramètres
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Plan & abonnement
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Tu es actuellement sur le plan{" "}
                    <span className="font-medium text-foreground">
                        {planInfo.plan.label}
                    </span>
                    . Compare avec les autres options ci-dessous.
                </p>
            </div>

            {justUpgraded && (
                <div className="border border-primary/30 bg-primary/5 px-5 py-4 text-sm">
                    Ton paiement a été traité par Stripe. La mise à jour de ton plan
                    peut prendre quelques secondes — recharge la page si tu ne vois
                    pas encore le nouveau statut.
                </div>
            )}

            {/* Banner status subscription (si active/past_due/canceled) */}
            <SubscriptionStatusBanner planInfo={planInfo} orgId={ctx.org.id} />

            <div>
                <h2 className="font-display text-xl tracking-tight mb-6">
                    {planInfo.orgType === "etang"
                        ? "Plans étang"
                        : "Plans magasin"}
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {allPlans.map((plan) => {
                        const isCurrent = plan.id === planInfo.planId;
                        const isUpgrade =
                            !isCurrent &&
                            plan.priceCents > planInfo.plan.priceCents;
                        const isDowngrade =
                            !isCurrent &&
                            plan.priceCents < planInfo.plan.priceCents;

                        return (
                            <PlanCardCompact
                                key={plan.id}
                                plan={plan}
                                isCurrent={isCurrent}
                                orgId={ctx.org.id}
                                actionType={
                                    isUpgrade
                                        ? "upgrade"
                                        : isDowngrade
                                            ? "downgrade"
                                            : "info"
                                }
                                actionLabel={
                                    isUpgrade
                                        ? "Passer à ce plan"
                                        : isDowngrade
                                            ? "Pour rétrograder, annule l'abo"
                                            : undefined
                                }
                            />
                        );
                    })}
                </div>
            </div>

            {/* Section Facturation : portail Stripe pour gérer carte + factures */}
            {planInfo.hasStripeCustomer && (
                <div>
                    <h2 className="font-display text-xl tracking-tight mb-6">
                        Facturation
                    </h2>
                    <div className="border border-border bg-secondary/20 px-5 py-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">
                                    Gérer mes informations de paiement
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                                    Accède à tes factures, mets à jour ta carte
                                    bancaire ou modifie tes coordonnées de
                                    facturation directement chez Stripe.
                                </p>
                            </div>
                            <CustomerPortalButton orgId={ctx.org.id} />
                        </div>
                    </div>
                </div>
            )}

            <div className="border-t border-border pt-8">
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Le paiement est sécurisé par Stripe. Tu peux annuler à tout
                    moment depuis cette page — l&apos;abonnement reste actif
                    jusqu&apos;à la fin de la période en cours.
                </p>
            </div>
        </div>
    );
}