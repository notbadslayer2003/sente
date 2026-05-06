"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import {
    formatPlanPrice,
    type EtangPlan,
    type MagasinPlan,
} from "@/lib/constants/plans";
import { createSubscriptionCheckoutAction } from "@/app/actions/subscription";

type Props = {
    plan: EtangPlan | MagasinPlan;
    isCurrent: boolean;
    /** ID de l'org pour déclencher le checkout. Requis si action = upgrade. */
    orgId?: string;
    /** "upgrade" | "downgrade" | "info" — détermine le comportement du bouton */
    actionType?: "upgrade" | "downgrade" | "info";
    /** Override du label de bouton */
    actionLabel?: string;
    /** Désactive le bouton avec un label custom */
    actionDisabled?: boolean;
    actionDisabledLabel?: string;
};

export function PlanCardCompact({
                                    plan,
                                    isCurrent,
                                    orgId,
                                    actionType = "info",
                                    actionLabel,
                                    actionDisabled = false,
                                    actionDisabledLabel = "Bientôt disponible",
                                }: Props) {
    const [isPending, startTransition] = useTransition();

    const onUpgrade = () => {
        if (!orgId) {
            console.error("orgId requis pour upgrade");
            return;
        }
        const fd = new FormData();
        fd.set("org_id", orgId);
        fd.set("plan_id", plan.id);

        startTransition(async () => {
            const r = await createSubscriptionCheckoutAction(fd);
            if (r.ok && r.data?.url) {
                // Redirige vers Stripe Checkout (full page redirect, pas un router.push)
                window.location.href = r.data.url;
            } else {
                alert(r.ok ? "Erreur inconnue" : r.error);
            }
        });
    };

    const renderActionButton = () => {
        if (isCurrent) {
            return (
                <span className="block text-center px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground border border-dashed border-border">
                    Plan actuel
                </span>
            );
        }
        if (actionDisabled) {
            return (
                <span
                    className="block text-center px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground/60 border border-border cursor-not-allowed"
                    title={actionDisabledLabel}
                >
                    {actionDisabledLabel}
                </span>
            );
        }
        if (actionType === "upgrade" && orgId) {
            return (
                <button
                    type="button"
                    onClick={onUpgrade}
                    disabled={isPending}
                    className="block w-full text-center px-4 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending
                        ? "Redirection..."
                        : (actionLabel ?? "Passer à ce plan")}
                </button>
            );
        }
        if (actionType === "downgrade") {
            return (
                <span className="block text-center px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground border border-border cursor-not-allowed">
                    {actionLabel ?? "Plan inférieur"}
                </span>
            );
        }
        // Fallback : link vers signup (utilisé sur la page pricing publique)
        return (
            <Link
                href={`/signup`}
                className="block text-center px-4 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
            >
                {actionLabel ?? plan.ctaLabel}
            </Link>
        );
    };

    return (
        <div
            className={`p-6 sm:p-8 flex flex-col border ${
                isCurrent
                    ? "border-accent bg-accent/5"
                    : plan.highlight
                        ? "border-border bg-secondary/40"
                        : "border-border bg-background"
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {plan.label}
                    </p>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="font-display-soft text-3xl tracking-tight">
                            {formatPlanPrice(plan.priceCents)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {plan.period}
                        </span>
                    </div>
                </div>
                {isCurrent && (
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-accent text-accent-foreground">
                        Actuel
                    </span>
                )}
            </div>

            <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                {plan.description}
            </p>

            <ul className="mt-6 space-y-2 text-xs">
                {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                        <Check
                            className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5"
                            strokeWidth={2}
                        />
                        <span className="leading-relaxed">{f}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-auto pt-6">{renderActionButton()}</div>
        </div>
    );
}