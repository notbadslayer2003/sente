import Link from "next/link";

export function LegalLayout({
                                title,
                                lastUpdated,
                                children,
                            }: {
    title: string;
    lastUpdated: string;
    children: React.ReactNode;
}) {
    return (
        <>
            <section className="bg-background pt-32 pb-12 sm:pt-40 sm:pb-16 border-b border-border">
                <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Légal
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl sm:text-6xl tracking-tight leading-[0.95]">
                        {title}
                    </h1>
                    <p className="mt-6 text-sm text-muted-foreground">
                        Dernière mise à jour : {lastUpdated}
                    </p>
                </div>
            </section>

            <section className="bg-background py-16 sm:py-24">
                <article className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12 prose-sente">
                    {children}
                </article>
            </section>

            <section className="bg-secondary/40 py-12 border-t border-border">
                <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12 flex flex-wrap gap-x-6 gap-y-3 text-xs uppercase tracking-wide text-muted-foreground">
                    <Link href="/mentions-legales" className="hover:text-accent transition-colors">
                        Mentions légales
                    </Link>
                    <Link href="/cgu" className="hover:text-accent transition-colors">
                        CGU
                    </Link>
                    <Link href="/confidentialite" className="hover:text-accent transition-colors">
                        Confidentialité
                    </Link>
                    <Link href="/cookies" className="hover:text-accent transition-colors">
                        Cookies
                    </Link>
                </div>
            </section>
        </>
    );
}

export function LegalSection({
                                 title,
                                 children,
                             }: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mt-12 first:mt-0">
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight mb-4">
                {title}
            </h2>
            <div className="space-y-4 text-base leading-relaxed">{children}</div>
        </section>
    );
}