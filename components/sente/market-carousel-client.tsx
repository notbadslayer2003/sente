"use client";

import * as React from "react";
import Link from "next/link";
import { Eyebrow } from "./eyebrow";
import { buttonSenteClasses } from "./button-sente";

// ============================================================
// MarketCarouselClient — Client Component
//
// Port fidèle du carousel du design Claude :
// - Header : Eyebrow + h2 à gauche, boutons prev/next à droite (desktop)
// - Scroller horizontal flex, gap 16px, scroll-snap mandatory
// - Cards 300px largeur fixe, aspect 5/4 image, hover lift
// - CTA centré en bas : "Explorer toutes les annonces →"
//
// Pourquoi client :
// - useRef sur le scroller pour scrollBy()
// - Handlers onClick sur les arrows
// - useState (optionnel, plus tard) pour gérer disabled state des arrows
//   selon position scroll (pas implémenté ici, le design ne le fait pas)
//
// Note responsive :
// - Arrows cachées sur mobile (le swipe natif les remplace)
// - Padding section réduit sur mobile
// ============================================================

export type MarketCarouselItem = {
    id: string;
    href: string;
    title: string;
    priceLabel: string;
    city: string;
    /** Label avant la virgule dans l'eyebrow de la card (marque ou condition) */
    eyebrowLeft: string;
    photoUrl: string | null;
    stateLabel: string;
};

const SCROLL_STEP_PX = 320; // largeur card (300) + gap (16) + un peu

export function MarketCarouselClient({
                                         items,
                                     }: {
    items: MarketCarouselItem[];
}) {
    const scrollerRef = React.useRef<HTMLDivElement>(null);

    function scroll(direction: -1 | 1) {
        scrollerRef.current?.scrollBy({
            left: direction * SCROLL_STEP_PX,
            behavior: "smooth",
        });
    }

    return (
        <section className="bg-white px-6 py-20 md:px-14 md:pt-30 md:pb-24">
            {/* ----- Header (eyebrow + h2 à gauche, arrows à droite) ----- */}
            <div className="mb-9 flex items-end justify-between gap-8">
                <div>
                    <Eyebrow className="mb-3.5">Marketplace · nouveautés du jour</Eyebrow>
                    <h2
                        className="font-body font-medium text-ink m-0
                       text-3xl md:text-[52px]
                       leading-[1.05] tracking-[-0.025em]
                       max-w-[760px]"
                    >
                        Ce qui vient d&apos;être déposé par la communauté.
                    </h2>
                </div>

                {/* Arrows : cachées sous md (swipe naturel) */}
                <div className="hidden md:flex items-center gap-2.5 shrink-0">
                    <ArrowButton direction="prev" onClick={() => scroll(-1)} />
                    <ArrowButton direction="next" onClick={() => scroll(1)} />
                </div>
            </div>

            {/* ----- Scroller ----- */}
            <div
                ref={scrollerRef}
                className="flex gap-4 overflow-x-auto pb-2
                   snap-x snap-mandatory
                   -mx-4 px-4
                   [scrollbar-width:thin]"
            >
                {items.map((item) => (
                    <ListingCard key={item.id} item={item} />
                ))}
            </div>

            {/* ----- CTA bottom centré -----
          buttonSenteClasses appliqué directement au <Link> : un seul élément
          dans le DOM (pas d'imbrication a > button qui serait invalide HTML). */}
            <div className="mt-10 text-center">
                <Link
                    href="/marketplace"
                    aria-label="Voir toutes les annonces du marketplace"
                    className={buttonSenteClasses({ kind: "primary", size: "lg" })}
                >
                    Explorer toutes les annonces →
                </Link>
            </div>
        </section>
    );
}

// ------------------------------------------------------------
// Sous-composants
// ------------------------------------------------------------

function ListingCard({ item }: { item: MarketCarouselItem }) {
    return (
        <Link
            href={item.href}
            className="group shrink-0 basis-[300px] snap-start
                 flex flex-col
                 bg-white border border-line rounded-md overflow-hidden
                 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]
                 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]
                 no-underline"
        >
            {/* Image : aspect 5/4, fallback "Sans photo" si absente */}
            <div className="relative aspect-[5/4] bg-warm overflow-hidden">
                {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.photoUrl}
                        alt={item.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover
                       transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                ) : (
                    <div className="absolute inset-0 grid place-items-center">
            <span className="text-[10px] uppercase tracking-[0.2em] text-mute">
              Sans photo
            </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col px-[18px] pt-4 pb-[18px]">
                <p
                    className="text-[11px] font-medium uppercase tracking-[0.04em]
                     text-mute mb-1.5"
                >
                    {item.eyebrowLeft} · {item.city}
                </p>

                <p
                    className="flex-1 font-body text-[15px] font-medium leading-[1.3]
                     text-ink mb-3.5 line-clamp-2"
                >
                    {item.title}
                </p>

                <div className="flex items-baseline justify-between">
          <span className="font-body font-semibold text-[22px] text-ink tracking-[-0.02em]">
            {item.priceLabel}
          </span>
                    <span className="text-xs text-mute">{item.stateLabel}</span>
                </div>
            </div>
        </Link>
    );
}

function ArrowButton({
                         direction,
                         onClick,
                     }: {
    direction: "prev" | "next";
    onClick: () => void;
}) {
    const isPrev = direction === "prev";
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={isPrev ? "Précédent" : "Suivant"}
            className="grid place-items-center
                 w-11 h-11 rounded-full
                 bg-white border border-line
                 cursor-pointer
                 transition-colors duration-200
                 hover:border-ink
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-ink"
                aria-hidden="true"
            >
                {isPrev ? (
                    <path d="M 15 6 L 9 12 L 15 18" />
                ) : (
                    <path d="M 9 6 L 15 12 L 9 18" />
                )}
            </svg>
        </button>
    );
}