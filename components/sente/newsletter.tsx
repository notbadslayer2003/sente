export function Newsletter() {
    return (
        <section className="bg-background py-24 sm:py-32">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12 text-center space-y-8">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Restez informé
                </p>
                <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                    Sente arrive bientôt.
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
                    Soyez prévenu au lancement officiel et recevez en avant-première
                    les nouveaux lieux et magasins référencés.
                </p>

                <form className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto pt-2">
                    <input
                        type="email"
                        placeholder="votre@email.be"
                        className="flex-1 px-4 py-3.5 bg-card border border-border focus:border-primary focus:outline-none text-sm transition-colors"
                        required
                    />
                    <button
                        type="submit"
                        className="bg-primary text-primary-foreground px-6 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-primary/90 transition-colors"
                    >
                        S&apos;inscrire
                    </button>
                </form>

                <p className="text-xs text-muted-foreground/70">
                    Pas de spam. Désinscription en un clic. Conforme RGPD.
                </p>
            </div>
        </section>
    );
}