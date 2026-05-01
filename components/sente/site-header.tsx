import Link from "next/link";

export function SiteHeader() {
    return (
        <header className="fixed top-0 inset-x-0 z-50 bg-background border-b border-border">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
                <Link
                    href="/"
                    className="font-display text-2xl tracking-tight text-foreground hover:text-accent transition-colors"
                >
                    Sente
                </Link>
                <nav className="flex items-center gap-6 sm:gap-8 text-sm">
                    <Link
                        href="/lieux"
                        className="hidden sm:inline-flex text-foreground hover:text-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        Étangs
                    </Link>
                    <Link
                        href="/magasins"
                        className="hidden sm:inline-flex text-foreground hover:text-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        Magasins
                    </Link>
                    <Link
                        href="/partenaires"
                        className="hidden md:inline-flex text-foreground hover:text-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        Pros
                    </Link>
                    <Link
                        href="/login"
                        className="text-foreground/70 hover:text-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        Connexion
                    </Link>
                    <Link
                        href="/signup"
                        className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-4 py-2 uppercase tracking-wide text-xs font-medium"
                    >
                        Créer un compte
                    </Link>
                </nav>
            </div>
        </header>
    );
}