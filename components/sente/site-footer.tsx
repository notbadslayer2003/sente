import Link from "next/link";

export function SiteFooter() {
    return (
        <footer className="bg-foreground text-background">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-16 sm:py-20">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
                    <div className="col-span-2 lg:col-span-1 space-y-4">
                        <Link
                            href="/"
                            className="font-display text-3xl tracking-tight inline-block"
                        >
                            Sente
                        </Link>
                        <p className="text-sm text-background/70 leading-relaxed max-w-xs">
                            La plateforme des pêcheurs, des étangs et des magasins
                            spécialisés. Wallonie & France.
                        </p>
                    </div>

                    <Col title="Pêcheurs">
                        <FooterLink href="/lieux">Trouver un étang</FooterLink>
                        <FooterLink href="/magasins">Magasins partenaires</FooterLink>
                        <FooterLink href="/feed">Fil communauté</FooterLink>
                        <FooterLink href="/signup">Créer un compte</FooterLink>
                    </Col>

                    <Col title="Pros">
                        <FooterLink href="/partenaires">Tarifs étang & magasin</FooterLink>
                        <FooterLink href="/partenaires#etang">Référencer mon étang</FooterLink>
                        <FooterLink href="/partenaires#magasin">Référencer mon magasin</FooterLink>
                        <FooterLink href="/contact">Nous contacter</FooterLink>
                    </Col>

                    <Col title="Légal">
                        <FooterLink href="/mentions-legales">Mentions légales</FooterLink>
                        <FooterLink href="/cgu">CGU</FooterLink>
                        <FooterLink href="/confidentialite">Confidentialité</FooterLink>
                        <FooterLink href="/cookies">Cookies</FooterLink>
                    </Col>
                </div>

                <div className="mt-16 pt-8 border-t border-background/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-background/50">
                    <p>© {new Date().getFullYear()} Sente — TwoStack, Mons.</p>
                    <p className="uppercase tracking-[0.2em]">Pêche · Wallonie & France</p>
                </div>
            </div>
        </footer>
    );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-background/50 font-medium">
                {title}
            </p>
            <ul className="space-y-2.5">{children}</ul>
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
                className="text-sm text-background/80 hover:text-accent transition-colors"
            >
                {children}
            </Link>
        </li>
    );
}