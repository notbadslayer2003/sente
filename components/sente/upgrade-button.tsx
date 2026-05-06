"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import {
    type EtangPlan,
    type MagasinPlan,
} from "@/lib/constants/plans";

type Props = {
    slug: string;
    /** Plan requis pour débloquer */
    requiredPlan: EtangPlan | MagasinPlan;
    /** Texte du bouton (ex: "Ajouter une photo") */
    label: string;
    /** Tooltip plus détaillé (apparaît au hover) */
    tooltip?: string;
    /** Variant visuel : default (sombre) ou subtle (gris clair) */
    variant?: "default" | "subtle";
    /** Taille du bouton */
    size?: "sm" | "md";
    className?: string;
};

/**
 * Bouton verrouillé qui redirige vers la page paramètres pour upgrade.
 * Utilisé partout où une action est bloquée par feature gating
 * (ex: bouton "Ajouter photo" en plan Starter avec déjà 1 photo).
 *
 * Pas de modal pour l'instant : redirect direct vers /parametres pour
 * voir les plans. Plus simple et clair UX.
 */
export function UpgradeButton({
                                  slug,
                                  requiredPlan,
                                  label,
                                  tooltip,
                                  variant = "default",
                                  size = "md",
                                  className = "",
                              }: Props) {
    const sizeClasses =
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";

    const variantClasses =
        variant === "subtle"
            ? "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
            : "border border-border text-muted-foreground hover:border-accent hover:text-accent";

    const finalTooltip =
        tooltip ??
        `Disponible avec le plan ${requiredPlan.label} (${requiredPlan.priceCents / 100}€/mois)`;

    return (
        <Link
            href={`/dashboard/${slug}/parametres`}
            title={finalTooltip}
            className={`inline-flex items-center gap-2 uppercase tracking-wide transition-colors ${sizeClasses} ${variantClasses} ${className}`}
        >
            <Lock className="w-3 h-3" strokeWidth={1.75} />
            <span>{label}</span>
        </Link>
    );
}