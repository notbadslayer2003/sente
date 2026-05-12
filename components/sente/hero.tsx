'use client';

import Link from "next/link";
import { useEffect, useRef } from "react";

export function Hero() {
    const bgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        if (prefersReducedMotion) {
            if (bgRef.current) {
                bgRef.current.style.transform = "translate3d(0, 0, 0)";
            }
            return;
        }

        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(() => {
                if (bgRef.current) {
                    const y = window.scrollY * 0.4;
                    bgRef.current.style.transform = `translate3d(0, ${y}px, 0)`;
                }
                ticking = false;
            });
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <section className="relative min-h-screen w-full overflow-hidden pt-30">
            <div
                ref={bgRef}
                className="absolute -inset-x-0 -top-[15%] h-[130%] bg-cover bg-center bg-no-repeat will-change-transform"
                style={{ backgroundImage: "url('/images/img2Sente.webp')" }}
                aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/80" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent" />

            <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-full flex flex-col">
                <div className="pt-12 sm:pt-16">
                    <p className="font-body text-xs sm:text-sm uppercase tracking-[0.25em] text-white/85">
                        Pêche · Wallonie & France
                    </p>
                </div>

                <div className="mt-auto pb-20 sm:pb-28 max-w-4xl">
                    <h1 className="font-display-soft text-white text-[clamp(2.5rem,7vw,7rem)] leading-[0.95] tracking-[-0.02em]">
                        Tout pour la pêche,
                        <br />
                        <span className="italic font-light">en un seul endroit.</span>
                    </h1>

                    <p className="mt-8 max-w-xl text-white/85 text-base sm:text-lg leading-relaxed">
                        Trouvez un étang. Achetez votre matos. Suivez la communauté qui
                        fait vivre la pêche en Wallonie et en France.
                    </p>

                    <div className="mt-10 flex flex-wrap items-center gap-4">
                        <Link
                            href="/lieux"
                            className="inline-flex items-center justify-center bg-accent text-accent-foreground px-7 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-accent/90 transition-colors"
                        >
                            Trouver un étang
                        </Link>
                        <Link
                            href="/magasins"
                            className="inline-flex items-center justify-center border border-white/40 text-white px-7 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-white/10 transition-colors backdrop-blur-sm"
                        >
                            Voir les magasins
                        </Link>
                        <Link
                            href="#comment-ca-marche"
                            className="text-white/80 text-sm uppercase tracking-wide border-b border-white/40 pb-1 hover:text-white hover:border-white transition-colors"
                        >
                            Comment ça marche →
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