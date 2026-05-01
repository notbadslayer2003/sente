import Link from "next/link";

export const metadata = { title: "Fil communauté — Sente" };

export default function FeedPage() {
    return (
        <section className="bg-background min-h-screen pt-32 pb-16 flex items-center">
            <div className="mx-auto max-w-2xl px-6 sm:px-8 lg:px-12 text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Bientôt disponible
                </p>
                <h1 className="mt-4 font-display-soft text-5xl sm:text-6xl tracking-tight leading-[0.95]">
                    Le fil communauté.
                </h1>
                <p className="mt-8 text-base sm:text-lg text-muted-foreground leading-relaxed">
                    Posts d&apos;étangs, prises des pêcheurs, événements à venir, conseils
                    matos. Le fil ouvrira en même temps que les comptes pêcheurs, dans les
                    prochaines semaines.
                </p>
                <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
                    <Link
                        href="/lieux"
                        className="inline-flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-7 py-3.5 text-sm font-medium tracking-wide uppercase"
                    >
                        Voir les étangs
                    </Link>
                    <Link
                        href="/signup"
                        className="inline-flex items-center justify-center border border-foreground hover:bg-foreground hover:text-background transition-colors px-7 py-3.5 text-sm font-medium tracking-wide uppercase"
                    >
                        Être prévenu
                    </Link>
                </div>
            </div>
        </section>
    );
}