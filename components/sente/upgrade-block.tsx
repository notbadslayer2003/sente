import Link from "next/link";
import { Lock } from "lucide-react";
import {
    type EtangPlan,
    type MagasinPlan,
    formatPlanPrice,
} from "@/lib/constants/plans";

type Props = {
    /** Slug de l'org pour le lien vers paramètres */
    slug: string;
    /** Titre de la page bloquée (ex: "Registre pêcheurs") */
    featureName: string;
    /** Plan requis pour débloquer */
    requiredPlan: EtangPlan | MagasinPlan;
    /** Description plus longue de ce que la feature apporte */
    description?: string;
};

/**
 * Block d'upgrade affiché à la place d'une page entière quand la feature
 * est inaccessible sur le plan actuel. Plus impactant qu'un simple disabled.
 */
export function UpgradeBlock({
                                 slug,
                                 featureName,
                                 requiredPlan,
                                 description,
                             }: Props) {
    return (
        <div className="border border-border bg-secondary/20 px-8 py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 text-accent mb-6">
                <Lock className="w-5 h-5" strokeWidth={1.5} />
            </div>

            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Feature réservée
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight">
                {featureName}
            </h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                {description ??
                    `Cette fonctionnalité est incluse dans le plan ${requiredPlan.label}.`}
            </p>

            <div className="mt-8 inline-block border border-border bg-background p-6 text-left max-w-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Plan {requiredPlan.label}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display-soft text-3xl tracking-tight">
                        {formatPlanPrice(requiredPlan.priceCents)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {requiredPlan.period}
                    </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    {requiredPlan.description}
                </p>
            </div>

            <div className="mt-8">
                <Link
                    href={`/dashboard/${slug}/parametres`}
                    className="inline-flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-7 py-3 text-xs font-medium uppercase tracking-wide"
                >
                    Passer à {requiredPlan.label} →
                </Link>
            </div>
        </div>
    );
}