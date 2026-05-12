import Link from "next/link";
import { Eyebrow } from "./eyebrow";

// ============================================================
// ThreeUses (v2)
//
// Variante du design Claude : on garde la card du design récent
// (background white, status pill, icon vert, CTA border-top)
// mais on remplace le paragraphe "sub" par une liste de 3 items
// avec puces "trait horizontal vert" — héritage du précédent
// CommentCaMarche que Mathis aimait.
//
// La liste raconte plus précisément les fonctionnalités de chaque
// usage, plutôt qu'une phrase de pitch.
// ============================================================

type CardData = {
    status: "active" | "soon";
    title: string;
    items: string[];
    ctaLabel: string;
    href: string;
    icon: React.ReactNode;
};

const CARDS: CardData[] = [
    {
        status: "active",
        title: "Le marketplace.",
        items: [
            "Achète et vends ton matériel d'occasion entre passionnés",
            "Paiement séquestré via Sente Protect, vendeurs vérifiés",
            "Aucune commission cachée, prix tout compris",
        ],
        ctaLabel: "Découvrir",
        href: "/marketplace",
        icon: <MarketplaceIcon />,
    },
    {
        status: "soon",
        title: "Les étangs.",
        items: [
            "La carte vivante des spots en Wallonie et en France",
            "Postes, espèces, dispo en temps réel",
            "Avis vérifiés de la communauté pêche",
        ],
        ctaLabel: "Rejoindre la waitlist",
        href: "#waitlist",
        icon: <EtangsIcon />,
    },
    {
        status: "soon",
        title: "Les magasins.",
        items: [
            "L'annuaire des boutiques indépendantes près de chez toi",
            "Stock, horaires, spécialités au quotidien",
            "Conseils d'experts terrain qui pêchent aussi",
        ],
        ctaLabel: "Rejoindre la waitlist",
        href: "#waitlist",
        icon: <MagasinsIcon />,
    },
];

export function ThreeUses() {
    return (
        <section className="bg-paper px-6 py-20 md:px-14 md:py-30">
            {/* ----- Header centré ----- */}
            <div className="max-w-[720px] mx-auto text-center mb-12 md:mb-16">
                <Eyebrow className="mb-4">Comment ça marche</Eyebrow>
                <h2
                    className="font-body font-medium text-ink m-0
                     text-3xl md:text-[56px]
                     leading-[1.05] tracking-[-0.025em]"
                >
                    Une plateforme, trois usages.
                </h2>
                <p className="font-body text-[17px] text-body-ink leading-[1.55] mt-[18px]">
                    On commence par le marketplace. Les étangs et les magasins arrivent
                    dans les mois qui viennent — rejoins la liste si tu veux être des
                    premiers.
                </p>
            </div>

            {/* ----- Grille 3 cards ----- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[1320px] mx-auto">
                {CARDS.map((card) => (
                    <Card key={card.title} card={card} />
                ))}
            </div>
        </section>
    );
}

// ------------------------------------------------------------
// Card
// ------------------------------------------------------------

function Card({ card }: { card: CardData }) {
    const isActive = card.status === "active";

    return (
        <div
            className={[
                "relative flex flex-col",
                "bg-white border border-line rounded-lg",
                "px-8 pt-9 pb-8",
                isActive ? "" : "opacity-[0.92]",
            ].join(" ")}
        >
            {/* ----- Pill status (top-right) ----- */}
            <div
                className={[
                    "absolute top-6 right-6",
                    "px-2.5 py-1 rounded-full",
                    "text-[10px] font-semibold uppercase tracking-[0.1em] leading-none",
                    isActive
                        ? "bg-green text-white"
                        : "bg-warm text-[#7A5A1F]",
                ].join(" ")}
            >
                {isActive ? "● En ligne" : "Bientôt"}
            </div>

            {/* ----- Icon (vert) ----- */}
            <div className="text-green mb-7">{card.icon}</div>

            {/* ----- Titre ----- */}
            <h3 className="font-body font-medium text-ink m-0 text-[32px] leading-[1.1] tracking-[-0.02em]">
                {card.title}
            </h3>

            {/* ----- Liste à puces ----- */}
            <ul className="flex-1 mt-5 mb-7 flex flex-col gap-3 list-none p-0 m-0">
                {card.items.map((item) => (
                    <li
                        key={item}
                        className="flex gap-3 font-body text-sm text-body-ink leading-[1.55]"
                    >
                        {/* Puce = trait horizontal vert fin, aligné avec le milieu
                de la première ligne de texte (mt-[11px] approx = (22 / 2) - 0) */}
                        <span
                            aria-hidden="true"
                            className="shrink-0 w-3 h-px bg-green mt-[11px]"
                        />
                        <span>{item}</span>
                    </li>
                ))}
            </ul>

            {/* ----- CTA avec border-top ----- */}
            <Link
                href={card.href}
                prefetch={false}
                className="inline-flex items-center gap-1.5
                   font-body text-sm font-medium text-ink no-underline
                   border-t border-line pt-[18px]
                   hover:text-green transition-colors duration-200"
            >
                {card.ctaLabel}
                <span aria-hidden="true">→</span>
            </Link>
        </div>
    );
}

// ------------------------------------------------------------
// Icônes (SVG inline depuis le design)
// ------------------------------------------------------------

function MarketplaceIcon() {
    return (
        <svg
            width="32" height="32" viewBox="0 0 32 32"
            fill="none" stroke="currentColor" strokeWidth="1.4"
            aria-hidden="true"
        >
            <path d="M 6 11 L 8 7 H 24 L 26 11 V 25 H 6 Z" />
            <path d="M 6 11 H 26" />
            <path d="M 12 16 V 21" />
            <path d="M 16 16 V 21" />
            <path d="M 20 16 V 21" />
        </svg>
    );
}

function EtangsIcon() {
    return (
        <svg
            width="32" height="32" viewBox="0 0 32 32"
            fill="none" stroke="currentColor" strokeWidth="1.4"
            aria-hidden="true"
        >
            <path d="M 3 22 Q 8 17, 13 22 T 23 22 T 29 22" />
            <path d="M 3 17 Q 8 13, 13 17 T 23 17 T 29 17" opacity="0.5" />
            <path d="M 20 9 L 23 12 L 25 8" />
            <ellipse cx="22" cy="11" rx="3" ry="1.5" transform="rotate(-20 22 11)" />
        </svg>
    );
}

function MagasinsIcon() {
    return (
        <svg
            width="32" height="32" viewBox="0 0 32 32"
            fill="none" stroke="currentColor" strokeWidth="1.4"
            aria-hidden="true"
        >
            <path d="M 6 12 V 25 H 26 V 12" />
            <path d="M 4 8 H 28 L 26 13 Q 24 16, 22 13 Q 20 16, 18 13 Q 16 16, 14 13 Q 12 16, 10 13 Q 8 16, 6 13 Z" />
            <path d="M 13 25 V 18 H 19 V 25" />
        </svg>
    );
}