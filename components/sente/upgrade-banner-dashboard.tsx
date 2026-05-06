import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
    type EtangPlan,
    type MagasinPlan,
} from "@/lib/constants/plans";

type Props = {
    slug: string;
    currentPlan: EtangPlan | MagasinPlan;
    upgradePlan: EtangPlan | MagasinPlan;
};

/**
 * Bandeau persistant en haut du dashboard pour proposer l'upgrade
 * aux orgs en plan gratuit. Cliquable, redirige vers /parametres.
 */
export function UpgradeBannerDashboard({ slug, currentPlan, upgradePlan }: Props) {
    return (
        <Link
            href={`/dashboard/${slug}/parametres`}
            className="block border border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors px-5 py-4"
        >
            <div className="flex items-start gap-4">
                <Sparkles
                    className="w-4 h-4 text-accent shrink-0 mt-0.5"
                    strokeWidth={1.75}
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm">
                        Tu utilises{" "}
                        <span className="font-medium">{currentPlan.label}</span>.
                        Découvre ce que <strong>{upgradePlan.label} </strong> peut
                        t&apos;apporter.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {upgradePlan.description}
                    </p>
                </div>
                <span className="text-xs uppercase tracking-wide text-accent shrink-0 hidden sm:inline">
                    Voir les plans →
                </span>
            </div>
        </Link>
    );
}