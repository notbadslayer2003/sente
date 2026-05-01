import Link from "next/link";
import Image from "next/image";

export function Hero() {
    return (
        <section className="relative min-h-screen w-full overflow-hidden pt-30">
            <div className="absolute inset-0">
                <Image
                    src="https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=2400&q=85"
                    alt="Brume sur un étang à l'aube"
                    fill
                    priority
                    quality={90}
                    className="object-cover"
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/80" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent" />
            </div>

            <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-full flex flex-col">
                <div className="pt-12 sm:pt-16">
                    <p className="font-body text-xs sm:text-sm uppercase tracking-[0.25em] text-white/85">
                        Wallonie · Pêche & chasse
                    </p>
                </div>

                <div className="mt-auto pb-20 sm:pb-28 max-w-4xl">
                    <h1 className="font-display-soft text-white text-[clamp(2.5rem,7vw,7rem)] leading-[0.95] tracking-[-0.02em]">
                        Le territoire wallon
                        <br />
                        <span className="italic font-light">
              vu par ceux qui le pêchent et le chassent.
            </span>
                    </h1>

                    <p className="mt-8 max-w-xl text-white/85 text-base sm:text-lg leading-relaxed">
                        Annuaire des lieux, des magasins et des exploitants — vérifié,
                        tenu à jour, sans bruit.
                    </p>

                    <div className="mt-10 flex flex-wrap gap-3">
                        <Link
                            href="/lieux"
                            className="inline-flex items-center justify-center bg-accent text-accent-foreground px-7 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-accent/90 transition-colors"
                        >
                            Explorer les lieux
                        </Link>
                        <Link
                            href="/magasins"
                            className="inline-flex items-center justify-center border border-white/40 text-white px-7 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-white/10 transition-colors backdrop-blur-sm"
                        >
                            Voir les magasins
                        </Link>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:flex flex-col items-center gap-2 text-white/60">
                <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
                <div className="w-px h-12 bg-gradient-to-b from-white/60 to-transparent" />
            </div>
        </section>
    );
}