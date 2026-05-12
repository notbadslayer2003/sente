"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ButtonSente, buttonSenteClasses } from "./button-sente";
import {UserMenu} from "@/components/sente/user-menu";

// ============================================================
// SiteHeaderClient
//
// Port fidèle du <Nav /> du design Claude (shared.jsx) :
// - Sticky top, blur backdrop
// - Bordure inférieure qui apparaît à scrollY > 40px (sinon transparente)
// - Background opacité 0.6 en haut, 0.92 dès qu'on scrolle
// - Logo SVG (courbe verte + point) + wordmark "Sente" en Inter Tight 600
// - 3 liens : Marketplace / Étangs / Magasins, soulignement vert sur l'actif
// - Boutons Connexion (ghost sm) + Inscription (primary sm)
//
// Pourquoi client component :
// - useState pour le scroll state
// - useEffect pour le listener scroll
// - usePathname() pour détecter le lien actif sans prop manuelle
//
// Garde-fou perf : on throttle pas le scroll listener (l'opération est
// O(1) — une comparaison + un setState court-circuit React si la valeur
// ne change pas). Si Sentry remonte du jank, on passera en passive +
// requestAnimationFrame.
// ============================================================

type NavLink = {
    label: string;
    href: string;
    /** Préfixes considérés comme "actifs" (ex: /marketplace/sodbaits) */
    matchPrefixes: string[];
};

const NAV_LINKS: NavLink[] = [
    { label: "Marketplace", href: "/marketplace", matchPrefixes: ["/marketplace"] },
    { label: "Étangs",      href: "/etangs",      matchPrefixes: ["/etangs", "/lieux"] },
    { label: "Magasins",    href: "/magasins",    matchPrefixes: ["/magasins"] },
];

function isLinkActive(pathname: string, link: NavLink) {
    return link.matchPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    );
}

export function SiteHeaderClient() {
    const pathname = usePathname() ?? "/";
    const [scrolled, setScrolled] = React.useState(false);

    React.useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        // État initial correct si l'utilisateur arrive sur une page déjà scrollée
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={[
                "sticky top-0 z-50",
                "flex items-center justify-between",
                "px-6 py-[18px] md:px-14",
                "backdrop-blur-xl",
                "transition-[background-color,border-color] duration-200",
                scrolled
                    ? "bg-white/[0.92] border-b border-line"
                    : "bg-white/60 border-b border-transparent",
            ].join(" ")}
        >
            {/* ------- Logo + wordmark ------- */}
            <Link
                href="/"
                prefetch={false}
                className="flex items-center gap-2 no-underline"
                aria-label="Sente — accueil"
            >
                <svg
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    aria-hidden="true"
                    className="shrink-0"
                >
                    <path
                        d="M 2 14 Q 6 6, 11 11 T 20 8"
                        stroke="var(--sente-green)"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                    />
                    <circle cx="20" cy="8" r="1.8" fill="var(--sente-green)" />
                </svg>
                <span className="text-[18px] font-semibold tracking-[-0.01em] text-ink leading-none">
          Sente
        </span>
            </Link>

            {/* ------- Liens centraux ------- */}
            <nav className="hidden md:flex items-center gap-8 text-sm">
                {NAV_LINKS.map((link) => {
                    const active = isLinkActive(pathname, link);
                    return (
                        <Link
                            key={link.label}
                            href={link.href}
                            prefetch={false}
                            className={[
                                "relative no-underline transition-colors duration-200",
                                active
                                    ? "text-ink font-medium"
                                    : "text-body-ink font-normal hover:text-ink",
                            ].join(" ")}
                            aria-current={active ? "page" : undefined}
                        >
                            {link.label}
                            {active && (
                                <span
                                    aria-hidden="true"
                                    className="absolute left-0 right-0 -bottom-[7px] h-[2px] bg-green"
                                />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* ------- CTA auth ------- */}
            <div className="flex items-center gap-2.5">
                <Link
                    href="/login"
                    prefetch={false}
                    className={buttonSenteClasses({ kind: "ghost", size: "sm" })}
                >
                    Connexion
                </Link>
                <Link
                    href="/signup"
                    prefetch={false}
                    className={buttonSenteClasses({ kind: "primary", size: "sm" })}
                >
                    Inscription
                </Link>
                <UserMenu displayName="" email=""/>
            </div>
        </header>
    );
}