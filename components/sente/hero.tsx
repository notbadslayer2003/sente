"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eyebrow } from "./eyebrow";
import { ButtonSente } from "./button-sente";

// ============================================================
// Hero
//
// Port fidèle du <Hero /> du design Claude (sente.jsx).
//
// Structure (de l'arrière vers l'avant) :
// 1. Image background (img2Sente), background-position center 30%
// 2. Gradient noir vertical (0.18 → 0.10 → 0.62) — un seul gradient
// 3. Content (eyebrow, h1, p) aligné en bas via flex-end
// 4. Search dock en pill blanc, position absolute bottom -32px
//    → déborde sur la section suivante volontairement ; overflow:hidden
//      du parent coupe la partie qui dépasse (effet "ancré dans la section")
//
// Notes d'implémentation :
// - Pas de parallax (le design n'en a pas)
// - Pas de CTA buttons supplémentaires (le design n'en a pas non plus)
// - Hauteur fixe 760px desktop, dégradée sur mobile via min-h
// - Search dock = form natif, submit → /marketplace?q=...
//   Pas de useState : on lit la valeur via FormData (plus simple, moins de re-renders)
//
// Sécurité :
// - encodeURIComponent sur la query avant push (évite injection URL)
// - maxLength sur l'input pour éviter une URL de 50ko
// ============================================================

const SEARCH_MAX_LENGTH = 80;

export function Hero() {
    const router = useRouter();

    function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const raw = (formData.get("q") as string | null) ?? "";
        const q = raw.trim().slice(0, SEARCH_MAX_LENGTH);
        if (!q) {
            router.push("/marketplace");
            return;
        }
        router.push(`/marketplace?q=${encodeURIComponent(q)}`);
    }

    return (
        <section className="relative h-[760px] min-h-[600px] w-full">
            {/* ----- Background image ----- */}
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-cover bg-no-repeat"
                style={{
                    backgroundImage: "url('/images/img2Sente.webp')",
                    backgroundPosition: "center 40%",
                }}
            />

            {/* ----- Gradient overlay (un seul, vertical) -----
          Couleurs du design : top 0.18 → 40% 0.10 → bottom 0.62
          On reproduit avec les utilities Tailwind en gardant des stops custom. */}
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.10) 40%, rgba(0,0,0,0.62) 100%)",
                }}
            />

            {/* ----- Content (eyebrow + h1 + p) ----- */}
            <div className="relative h-full flex flex-col justify-end px-6 pt-16 pb-24 md:px-14 md:pb-30 text-white">
                <Eyebrow variant="light" className="mb-5">
                    Le marketplace de la pêche · Wallonie &amp; France
                </Eyebrow>

                <h1
                    className="font-body font-medium text-white max-w-[1000px] m-0
                     text-[clamp(2.5rem,7.5vw,5.75rem)]
                     leading-[1.02] tracking-[-0.025em]"
                >
                    Achète, vends, et trouve le matériel de pêche entre passionnés.
                </h1>

                <p className="mt-5 max-w-[620px] text-[17px] leading-[1.55] text-white/85">
                    Cannes, moulinets, bivouacs, leurres. Paiement sécurisé via Sente
                    Protect, vendeurs vérifiés, zéro commission cachée.
                </p>
            </div>

            {/* ----- Search dock (pill blanc qui déborde en bas) -----
          Le design utilise bottom: -32px dans un parent overflow:hidden.
          La moitié inférieure du dock est donc coupée volontairement. */}
            <form
                onSubmit={handleSearchSubmit}
                role="search"
                aria-label="Rechercher dans le marketplace"
                className="absolute left-6 right-6 -bottom-8 md:left-14 md:right-14
                   flex items-center gap-0 bg-white rounded-full p-1.5
                   shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
                style={{
                    zIndex: 10,
                }}
            >
                <div className="flex-1 px-3 py-1 md:pl-6 flex items-center gap-3 min-w-0">
                    <SearchIcon />
                    <input
                        type="search"
                        name="q"
                        maxLength={SEARCH_MAX_LENGTH}
                        placeholder="Cherche une canne, un moulinet, un bivvy…"
                        aria-label="Recherche produit"
                        className="flex-1 min-w-0 bg-transparent border-0 outline-none
                       text-[15px] md:text-base text-ink
                       placeholder:text-mute py-3"
                    />
                </div>
                <ButtonSente
                    kind="green"
                    size="lg"
                    type="submit"
                    className="shrink-0 px-5 md:px-8"
                >
                    Rechercher
                </ButtonSente>
            </form>
        </section>
    );
}

// ----- Icône loupe (inline pour éviter une dépendance lucide-react sur la home) -----
function SearchIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0 text-mute"
        >
            <circle cx="11" cy="11" r="7" />
            <path d="M 20 20 L 16 16" />
        </svg>
    );
}