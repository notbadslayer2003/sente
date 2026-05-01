import Image from "next/image";

export function APropos() {
    return (
        <section className="bg-background py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
                    <div className="lg:col-span-5 relative aspect-[4/5] overflow-hidden">
                        <Image
                            src="https://images.unsplash.com/photo-1490718720478-364a07a997cd?auto=format&fit=crop&w=1200&q=85"
                            alt="Brume sur un plan d'eau"
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 100vw, 40vw"
                        />
                    </div>

                    <div className="lg:col-span-7 space-y-8">
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Qui nous sommes
                        </p>
                        <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight max-w-2xl">
                            Une plateforme tenue par des passionnés, pour des passionnés.
                        </h2>
                        <div className="space-y-5 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl">
                            <p>
                                Sente répertorie les lieux de pêche et de chasse de Wallonie,
                                les magasins spécialisés qui comptent, et fournit aux
                                exploitants les outils pour gérer leurs membres et leurs
                                réservations.
                            </p>
                            <p>
                                Chaque lieu listé est vérifié. Chaque magasin référencé existe.
                                On préfère un annuaire dense et fiable à un catalogue gonflé
                                aux URLs mortes.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-border">
                            <Marker label="Les meilleurs spots carpe de Wallonie" />
                            <Marker label="Les magasins indépendants qui comptent" />
                            <Marker label="Les exploitants qu'on connaît un par un" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Marker({ label }: { label: string }) {
    return (
        <div className="space-y-2">
            <div className="w-8 h-px bg-primary" />
            <p className="text-sm leading-snug">{label}</p>
        </div>
    );
}