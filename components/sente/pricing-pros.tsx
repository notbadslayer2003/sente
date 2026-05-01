import Link from "next/link";
import { Check } from "lucide-react";

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
                        <Plan
                            label="Vitrine"
                            price="0€"
                            period="toujours"
                            description="Présence dans l'annuaire, posts, événements, commentaires. Sans limite."
                            features={[
                                "Fiche étang complète",
                                "Posts et événements illimités",
                                "Suiveurs et notifications",
                                "Modération inclusive",
                            ]}
                            cta={{ href: "/signup?role=etang", label: "Créer un compte gratuit" }}
                        />
                        <Plan
                            label="Dashboard CRM"
                            price="29€"
                            period="par mois"
                            description="Pour gérer vos pêcheurs annuels et longue durée. Plus 3 % sur paiements en ligne."
                            features={[
                                "Registre des pêcheurs annuels",
                                "Postes attribués (optionnel)",
                                "Paiements en ligne via Stripe",
                                "Exports comptables CSV",
                                "Multi-utilisateurs (équipe)",
                            ]}
                            cta={{ href: "/signup?role=etang&plan=crm", label: "Activer le dashboard" }}
                            highlight
                        />
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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-border border border-border">
                        <Plan
                            label="Starter"
                            price="0€"
                            period="par mois"
                            description="Pour démarrer la boutique sans risque. Commission 5 % sur ventes."
                            features={[
                                "Boutique en ligne intégrée",
                                "Catalogue limité (50 produits)",
                                "Posts et présence vitrine",
                                "Encaissement Stripe Connect",
                            ]}
                            cta={{ href: "/signup?role=magasin&plan=starter", label: "Démarrer gratuitement" }}
                        />
                        <Plan
                            label="Pro"
                            price="29€"
                            period="par mois"
                            description="Catalogue illimité, analytics. Commission 2,5 % sur ventes."
                            features={[
                                "Catalogue produits illimité",
                                "Variantes et stock",
                                "Analytics ventes et trafic",
                                "Bons promo trackés",
                                "Multi-utilisateurs",
                            ]}
                            cta={{ href: "/signup?role=magasin&plan=pro", label: "Choisir Pro" }}
                            highlight
                        />
                        <Plan
                            label="Boutique+"
                            price="79€"
                            period="par mois"
                            description="Volume et visibilité maximum. Commission 1 % sur ventes."
                            features={[
                                "Tout Pro inclus",
                                "Slot home magasin partenaire",
                                "Analytics avancée",
                                "Support prioritaire",
                                "Onboarding personnalisé",
                            ]}
                            cta={{ href: "/signup?role=magasin&plan=boutique-plus", label: "Choisir Boutique+" }}
                        />
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

function Plan({
                  label,
                  price,
                  period,
                  description,
                  features,
                  cta,
                  highlight = false,
              }: {
    label: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    cta: { href: string; label: string };
    highlight?: boolean;
}) {
    return (
        <div
            className={`p-8 sm:p-10 flex flex-col ${
                highlight ? "bg-secondary/40" : "bg-background"
            }`}
        >
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {label}
            </p>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display-soft text-5xl tracking-tight">{price}</span>
                <span className="text-sm text-muted-foreground">{period}</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                {description}
            </p>

            <ul className="mt-8 space-y-3 text-sm">
                {features.map((f) => (
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
                    href={cta.href}
                    className={`inline-flex items-center justify-center px-6 py-3 text-sm font-medium uppercase tracking-wide transition-colors w-full ${
                        highlight
                            ? "bg-accent text-accent-foreground hover:bg-accent/90"
                            : "border border-foreground hover:bg-foreground hover:text-background"
                    }`}
                >
                    {cta.label}
                </Link>
            </div>
        </div>
    );
}