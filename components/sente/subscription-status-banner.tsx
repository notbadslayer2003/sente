"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    cancelSubscriptionAction,
    reactivateSubscriptionAction,
} from "@/app/actions/subscription";
import { CustomerPortalButton } from "@/components/sente/customer-portal-button";
import type { OrgPlanInfo } from "@/lib/dal/plan";

type Props = {
    planInfo: OrgPlanInfo;
    orgId: string;
};

export function SubscriptionStatusBanner({ planInfo, orgId }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    if (planInfo.subscriptionStatus === "free") return null;

    const onCancel = () => {
        if (
            !confirm(
                "Annuler l'abonnement ? Tu garderas l'accès jusqu'à la fin de la période en cours."
            )
        ) {
            return;
        }
        const fd = new FormData();
        fd.set("org_id", orgId);
        startTransition(async () => {
            const r = await cancelSubscriptionAction(fd);
            if (r.ok) {
                router.refresh();
            } else {
                alert(r.error);
            }
        });
    };

    const onReactivate = () => {
        const fd = new FormData();
        fd.set("org_id", orgId);
        startTransition(async () => {
            const r = await reactivateSubscriptionAction(fd);
            if (r.ok) {
                router.refresh();
            } else {
                alert(r.error);
            }
        });
    };

    const formatDate = (iso: string | null) => {
        if (!iso) return "—";
        return new Date(iso).toLocaleDateString("fr-BE", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    };

    // Past due : grace period, on alerte fortement + accès portail pour update carte
    if (planInfo.subscriptionStatus === "past_due") {
        return (
            <div className="border border-destructive/30 bg-destructive/5 px-5 py-4">
                <p className="text-sm font-medium text-destructive">
                    Paiement en échec
                </p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    Stripe n&apos;a pas pu prélever ton dernier paiement. Mets à
                    jour ta carte bancaire pour conserver l&apos;accès au plan{" "}
                    {planInfo.plan.label}. Si rien n&apos;est fait, ton abonnement
                    sera annulé automatiquement sous quelques jours.
                </p>
                <div className="mt-3">
                    <CustomerPortalButton
                        orgId={orgId}
                        label="Mettre à jour ma carte"
                    />
                </div>
            </div>
        );
    }

    // Cancel scheduled : info + bouton réactiver
    if (planInfo.cancelAtPeriodEnd) {
        return (
            <div className="border border-accent/30 bg-accent/5 px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                            Annulation programmée
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            Ton abonnement {planInfo.plan.label} reste actif
                            jusqu&apos;au{" "}
                            <span className="font-medium text-foreground">
                                {formatDate(planInfo.currentPeriodEnd)}
                            </span>
                            . Après cette date, tu reviendras automatiquement au
                            plan gratuit.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onReactivate}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide border border-foreground px-4 py-2 hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 shrink-0"
                    >
                        {isPending ? "..." : "Annuler la résiliation"}
                    </button>
                </div>
            </div>
        );
    }

    // Active : status + bouton annuler. Le portail Stripe est exposé en
    // section "Facturation" sur la page paramètres, pas en double ici.
    if (planInfo.subscriptionStatus === "active") {
        return (
            <div className="border border-border bg-secondary/30 px-5 py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                            Abonnement actif — {planInfo.plan.label}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                            Renouvellement le{" "}
                            <span className="font-medium text-foreground">
                                {formatDate(planInfo.currentPeriodEnd)}
                            </span>
                            .
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 shrink-0"
                    >
                        {isPending ? "..." : "Annuler l'abonnement"}
                    </button>
                </div>
            </div>
        );
    }

    return null;
}