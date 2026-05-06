import Link from "next/link";
import { Check } from "lucide-react";
import {
    ETANG_PLANS_LIST,
    MAGASIN_PLANS_LIST,
    formatPlanPrice,
    type EtangPlan,
    type MagasinPlan,
} from "@/lib/constants/plans";

export function PricingPros() {
    return (
        <section className="bg-background py-24 sm:py-32 border-t border-border">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                {/* Étangs */}
                <div id="etang" className="mb-24 scroll-mt-24">
                    <div className="max-w-2xl mb-12">
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Pour les étangs
                        </p>
                        <h2 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight">
                            Vitrine gratuite, dashboard quand vous en avez besoin.
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border border border-border">
                        {ETANG_PLANS_LIST.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                signupHref={
                                    plan.id === "vitrine"
                                        ? "/signup?role=etang"
                                        : `/signup?role=etang&plan=${plan.id}`
                                }
                            />
                        ))}
                    </div>
                </div>

                {/* Magasins */}
                <div id="magasin" className="scroll-mt-24">
                    <div className="max-w-2xl mb-12">
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Pour les magasins
                        </p>
                        <h2 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight">
                            Vendez en ligne sans gérer de site.
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border border border-border">
                        {MAGASIN_PLANS_LIST.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                signupHref={`/signup?role=magasin&plan=${plan.id}`}
                            />
                        ))}
                    </div>
                </div>

                <p className="mt-12 text-sm text-muted-foreground text-center max-w-2xl mx-auto">
                    Aucun engagement long. Annulation à tout moment. Les commissions Stripe
                    Connect (1,5 % + 0,25 €) s&apos;ajoutent aux frais Sente, comme partout.
                </p>
            </div>
        </section>
    );
}

function PlanCard({
                      plan,
                      signupHref,
                  }: {
    plan: EtangPlan | MagasinPlan;
    signupHref: string;
}) {
    return (
        <div
            className={`p-8 sm:p-10 flex flex-col ${
                plan.highlight ? "bg-secondary/40" : "bg-background"
            }`}
        >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {plan.label}
            </p>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display-soft text-5xl tracking-tight">
                    {formatPlanPrice(plan.priceCents)}
                </span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                {plan.description}
            </p>

            <ul className="mt-8 space-y-3 text-sm">
                {plan.features.map((f) => (
                    <li key={f} className="flex gap-3">
                        <Check
                            className="w-4 h-4 text-accent shrink-0 mt-0.5"
                            strokeWidth={2}
                        />
                        <span className="leading-relaxed">{f}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-auto pt-10">
                <Link
                    href={signupHref}
                    className={`inline-flex items-center justify-center px-6 py-3 text-sm font-medium uppercase tracking-wide transition-colors w-full ${
                        plan.highlight
                            ? "bg-accent text-accent-foreground hover:bg-accent/90"
                            : "border border-foreground hover:bg-foreground hover:text-background"
                    }`}
                >
                    {plan.ctaLabel}
                </Link>
            </div>
        </div>
    );
}