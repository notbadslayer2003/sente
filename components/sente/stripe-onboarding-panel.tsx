"use client";

import { useState, useTransition } from "react";
import {
    createStripeOnboardingLinkAction,
    createStripeDashboardLinkAction,
    refreshStripeAccountAction,
} from "@/app/actions/stripe-onboarding";

export function StripeOnboardingPanel({
                                          orgId,
                                          hasAccount,
                                          isOnboarded,
                                          chargesEnabled,
                                          payoutsEnabled,
                                          commissionBps,
                                      }: {
    orgId: string;
    hasAccount: boolean;
    isOnboarded: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    commissionBps: number;
}) {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onConfigure = () => {
        setError(null);
        const fd = new FormData();
        fd.set("org_id", orgId);
        startTransition(async () => {
            const r = await createStripeOnboardingLinkAction(fd);
            if (r.ok && r.data) {
                window.location.href = r.data.url;
            } else if (!r.ok) {
                setError(r.error);
            }
        });
    };

    const onDashboard = () => {
        setError(null);
        const fd = new FormData();
        fd.set("org_id", orgId);
        startTransition(async () => {
            const r = await createStripeDashboardLinkAction(fd);
            if (r.ok && r.data) {
                window.open(r.data.url, "_blank", "noopener,noreferrer");
            } else if (!r.ok) {
                setError(r.error);
            }
        });
    };

    const onRefresh = () => {
        setError(null);
        const fd = new FormData();
        fd.set("org_id", orgId);
        startTransition(async () => {
            const r = await refreshStripeAccountAction(fd);
            if (!r.ok) setError(r.error);
            // Le revalidatePath côté serveur force un refresh de la page
        });
    };

    // ─── Aucun compte créé ────────────────────────────────────────────────
    if (!hasAccount) {
        return (
            <div className="border border-border bg-secondary/20 p-8 space-y-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Étape 1
                    </p>
                    <h2 className="mt-2 font-display text-2xl tracking-tight">
                        Configurer le compte Stripe
                    </h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                    Tu vas être redirigé vers Stripe pour fournir tes informations
                    bancaires (IBAN), pièce d&apos;identité, et infos sur ta structure
                    juridique. Stripe valide ton compte sous 1-3 jours en général.
                </p>
                <button
                    type="button"
                    onClick={onConfigure}
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3 text-sm font-medium tracking-wide uppercase disabled:opacity-50"
                >
                    {isPending ? "Préparation..." : "Configurer mes paiements"}
                </button>
                {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
        );
    }

    // ─── Compte créé mais onboarding inachevé ─────────────────────────────
    if (!isOnboarded) {
        return (
            <div className="border border-accent/30 bg-accent/5 p-8 space-y-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-accent">
                        En cours
                    </p>
                    <h2 className="mt-2 font-display text-2xl tracking-tight">
                        Onboarding Stripe à compléter
                    </h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                    Ton compte Stripe est créé mais l&apos;onboarding n&apos;est pas
                    terminé. Reprends-le pour pouvoir encaisser les paiements.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={onConfigure}
                        disabled={isPending}
                        className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3 text-sm font-medium tracking-wide uppercase disabled:opacity-50"
                    >
                        {isPending ? "Préparation..." : "Reprendre l'onboarding"}
                    </button>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        Rafraîchir le statut
                    </button>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
        );
    }

    // ─── Compte onboarded ─────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            <div className="border border-primary/30 bg-primary/5 p-8 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-primary">
                            Compte actif
                        </p>
                        <h2 className="mt-2 font-display text-2xl tracking-tight">
                            Stripe configuré
                        </h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <Status
                        label="Encaissement"
                        active={chargesEnabled}
                        labelOn="Tu peux recevoir des paiements"
                        labelOff="Pas encore activé par Stripe"
                    />
                    <Status
                        label="Virements"
                        active={payoutsEnabled}
                        labelOn="Versements sur ton IBAN actifs"
                        labelOff="Pas encore activés par Stripe"
                    />
                </div>
            </div>

            <div className="border border-border bg-secondary/20 p-6 text-sm">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Commission Sente
                </p>
                <p className="mt-2 font-display text-2xl tracking-tight">
                    {(commissionBps / 100).toFixed(2)}%
                </p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Prélevée automatiquement sur chaque paiement en ligne. Le reste
                    arrive sur ton IBAN sous 7 jours environ.
                </p>
            </div>

            <div className="border border-border bg-secondary/20 p-8 space-y-4">
                <h3 className="font-display text-lg tracking-tight">
                    Gérer mon compte Stripe
                </h3>
                <p className="text-sm text-muted-foreground">
                    Consulte tes paiements, modifie ton IBAN, télécharge tes relevés.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={onDashboard}
                        disabled={isPending}
                        className="border border-foreground hover:bg-foreground hover:text-background transition-colors px-6 py-3 text-sm font-medium tracking-wide uppercase disabled:opacity-50"
                    >
                        {isPending ? "..." : "Ouvrir le dashboard Stripe"}
                    </button>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        Rafraîchir le statut
                    </button>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
        </div>
    );
}

function Status({
                    label,
                    active,
                    labelOn,
                    labelOff,
                }: {
    label: string;
    active: boolean;
    labelOn: string;
    labelOff: string;
}) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {label}
            </p>
            <p
                className={`mt-1.5 text-sm flex items-start gap-2 ${
                    active ? "" : "text-muted-foreground"
                }`}
            >
        <span
            className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                active ? "bg-primary" : "bg-muted-foreground/40"
            }`}
        />
                <span>{active ? labelOn : labelOff}</span>
            </p>
        </div>
    );
}