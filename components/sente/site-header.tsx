import Link from "next/link";

export function SiteHeader() {
    return (
        <header className="fixed top-0 inset-x-0 z-[100] bg-background border-b border-border">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
                <Link href="/" className="font-display text-2xl tracking-tight">
                    Sente
                </Link>
                <nav className="flex items-center gap-8">
                    <Link
                        href="/lieux"
                        className="text-xs uppercase tracking-wide hover:text-primary transition-colors"
                    >
                        Lieux
                    </Link>
                    <Link
                        href="/magasins"
                        className="text-xs uppercase tracking-wide hover:text-primary transition-colors"
                    >
                        Magasins
                    </Link>
                    <Link
                        href="/contact"
                        className="text-xs uppercase tracking-wide hover:text-primary transition-colors"
                    >
                        Contact
                    </Link>
                    <Link
                        href="/login"
                        className="border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors px-4 py-2 text-xs uppercase tracking-wide"
                    >
                        Se connecter
                    </Link>
                </nav>
            </div>
        </header>
    );
}