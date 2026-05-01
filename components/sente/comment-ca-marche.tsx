import Link from "next/link";
import { Fish, Waves, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function CommentCaMarche() {
    return (
        <section
            id="comment-ca-marche"
            className="bg-background py-24 sm:py-32 border-t border-border"
        >
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <div className="max-w-2xl mb-16">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Comment ça marche
                    </p>
                    <h2 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                        Une plateforme, trois usages.
                    </h2>
                    <p className="mt-6 text-muted-foreground text-base sm:text-lg leading-relaxed">
                        Que vous soyez pêcheur, gestionnaire d&apos;étang ou magasin
                        spécialisé, Sente a été pensé pour vous.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-border border border-border">
                    <Persona
                        icon={Fish}
                        label="Pêcheurs"
                        title="Pêchez. Achetez. Partagez."
                        items={[
                            "Trouvez un étang en Wallonie ou en France",
                            "Achetez votre matos chez les magasins partenaires",
                            "Suivez vos étangs préférés et la communauté",
                        ]}
                        cta={{ href: "/signup", label: "Créer un compte gratuit" }}
                    />
                    <Persona
                        icon={Waves}
                        label="Étangs"
                        title="Listez. Gérez. Communiquez."
                        items={[
                            "Présence vitrine, posts et événements — gratuit",
                            "Registre membres, postes et paiements en ligne",
                            "Communauté qualifiée, prête à pêcher chez vous",
                        ]}
                        cta={{ href: "/partenaires", label: "Référencer mon étang" }}
                        highlight
                    />
                    <Persona
                        icon={Store}
                        label="Magasins"
                        title="Affichez-vous. Vendez en ligne."
                        items={[
                            "Présence vitrine et posts — gratuit",
                            "Boutique en ligne intégrée, paiements Stripe",
                            "Visibilité auprès d'une audience pêche pure",
                        ]}
                        cta={{ href: "/partenaires", label: "Référencer mon magasin" }}
                    />
                </div>
            </div>
        </section>
    );
}

function Persona({
                     icon: Icon,
                     label,
                     title,
                     items,
                     cta,
                     highlight = false,
                 }: {
    icon: LucideIcon;
    label: string;
    title: string;
    items: string[];
    cta: { href: string; label: string };
    highlight?: boolean;
}) {
    return (
        <div
            className={`p-8 sm:p-10 flex flex-col ${
                highlight ? "bg-secondary/40" : "bg-background"
            }`}
        >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center bg-accent/10 text-accent">
                    <Icon className="w-5 h-5" strokeWidth={1.75}/>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {label}
                </p>
            </div>
            <h3 className="mt-6 font-display text-2xl sm:text-3xl tracking-tight leading-tight">
                {title}
            </h3>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
                {items.map((item) => (
                    <li key={item} className="flex gap-3">
                        <span className="mt-2 w-3 h-px bg-primary shrink-0" />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>
            <div className="mt-auto pt-8">
                <Link
                    href={cta.href}
                    className="inline-flex items-center text-sm font-medium uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                >
                    {cta.label} →
                </Link>
            </div>
        </div>
    );
}