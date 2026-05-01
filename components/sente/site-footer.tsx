import Link from "next/link";

export function SiteFooter() {
    return (
        <footer className="bg-foreground text-background">
            {/* Bloc principal */}
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-16">
                    {/* Colonne brand */}
                    <div className="space-y-5">
                        <Link
                            href="/"
                            className="font-display-soft text-4xl tracking-tight inline-block"
                        >
                            Sente
                        </Link>
                        <p className="text-sm text-background/70 leading-relaxed max-w-xs">
                            L&apos;annuaire de la pêche et de la chasse en Wallonie.
                            Lieux, magasins, exploitants — au même endroit.
                        </p>
                        <p className="text-xs text-background/50 leading-relaxed pt-2">
                            Mons, Belgique
                            <br />
                            hello@sente.app
                        </p>
                    </div>

                    {/* Colonne Découvrir */}
                    <FooterColumn title="Découvrir">
                        <FooterLink href="/lieux">Lieux</FooterLink>
                        <FooterLink href="/magasins">Magasins</FooterLink>
                        <FooterLink href="/manifeste">À propos</FooterLink>
                    </FooterColumn>

                    {/* Colonne Pros */}
                    <FooterColumn title="Pour les professionnels">
                        <FooterLink href="/contact">Devenir partenaire</FooterLink>
                        <FooterLink href="/login">Connexion exploitant</FooterLink>
                        <FooterLink href="/contact">Nous contacter</FooterLink>
                    </FooterColumn>

                    {/* Colonne Légal */}
                    <FooterColumn title="Légal">
                        <FooterLink href="/mentions-legales">Mentions légales</FooterLink>
                        <FooterLink href="/cgu">Conditions d&apos;utilisation</FooterLink>
                        <FooterLink href="/confidentialite">Confidentialité</FooterLink>
                    </FooterColumn>
                </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-background/10">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-background/60">
                    <p className="tracking-wide">
                        © {new Date().getFullYear()} Sente — Tous droits réservés
                    </p>
                    <div className="flex items-center gap-5">
                    <a
                        href="https://instagram.com/sente.app"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-background transition-colors uppercase tracking-wider"
                        >
                        Instagram
                    </a>
                    <a
                    href="https://facebook.com/sente.app"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-background transition-colors uppercase tracking-wider"
                    >
                    Facebook
                </a>
            </div>
        </div>
</div>
</footer>
);
}

function FooterColumn({
                          title,
                          children,
                      }: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.25em] text-background/50">
                {title}
            </p>
            <ul className="space-y-3 text-sm">{children}</ul>
        </div>
    );
}

function FooterLink({
                        href,
                        children,
                    }: {
    href: string;
    children: React.ReactNode;
}) {
    return (
        <li>
            <Link
                href={href}
                className="text-background/85 hover:text-accent transition-colors"
            >
                {children}
            </Link>
        </li>
    );
}