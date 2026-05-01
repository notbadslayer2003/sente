import Link from "next/link";
import { PricingPros } from "@/components/sente/pricing-pros";
import { FaqPros } from "@/components/sente/faq-pros";

export default function PartenairesPage() {
    return (
        <>
            {/* Hero compact */}
            <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 bg-background border-b border-border overflow-hidden">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 relative">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Partenaires Sente
                    </p>
                    <h1 className="mt-4 font-display-soft text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95] max-w-4xl">
                        Référencez votre étang ou votre magasin.{" "}
                        <span className="italic font-light">Gardez le contrôle.</span>
                    </h1>
                    <p className="mt-8 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl">
                        Présence gratuite pour tous. Outils de gestion et e-commerce
                        à prix juste, sans engagement, pour ceux qui veulent aller plus loin.
                    </p>
                    <div className="mt-10 flex flex-wrap items-center gap-4">
                        <Link
                            href="#etang"
                            className="inline-flex items-center justify-center bg-accent text-accent-foreground px-7 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-accent/90 transition-colors"
                        >
                            Tarifs étang
                        </Link>
                        <Link
                            href="#magasin"
                            className="inline-flex items-center justify-center border border-foreground text-foreground px-7 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-foreground hover:text-background transition-colors"
                        >
                            Tarifs magasin
                        </Link>
                        <Link
                            href="/contact"
                            className="text-foreground/80 text-sm uppercase tracking-wide border-b border-foreground/40 pb-1 hover:text-accent hover:border-accent transition-colors"
                        >
                            Cas particulier ? Nous contacter →
                        </Link>
                    </div>
                </div>
            </section>

            <PricingPros />
            <FaqPros />
        </>
    );
}