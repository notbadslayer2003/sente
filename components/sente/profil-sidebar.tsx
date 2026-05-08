"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// =============================================================================
// Sidebar du dashboard user (espace /profil)
// =============================================================================
// Deux groupes :
//   - Mon profil : sections générales (vue d'ensemble, inscriptions étang,
//     commandes magasin B2C, suivis, paramètres)
//   - Marketplace : C2C (annonces, messages, commandes marketplace, compte
//     vendeur Stripe Connect)
//
// Note : la section Marketplace est toujours visible. Pour la rendre
// conditionnelle (apparaît seulement si l'user a une activité marketplace),
// passer un prop `hasMarketplaceActivity` depuis le layout et conditionner
// l'affichage du second groupe.
// =============================================================================

type Link = { href: string; label: string; exact?: boolean };

const PROFIL_LINKS: Link[] = [
    { href: "/profil", label: "Vue d'ensemble", exact: true },
    { href: "/profil/inscriptions", label: "Inscriptions" },
    { href: "/profil/commandes", label: "Commandes" },
    { href: "/profil/suivis", label: "Suivis" },
    { href: "/profil/parametres", label: "Paramètres" },
];

const MARKETPLACE_LINKS: Link[] = [
    { href: "/profil/marketplace/annonces", label: "Annonces" },
    { href: "/profil/marketplace/messages", label: "Messages" },
    { href: "/profil/marketplace/commandes", label: "Commandes" },
    { href: "/profil/marketplace/compte-vendeur", label: "Compte vendeur" },
];

export function ProfilSidebar({
                                  userEmail,
                                  fullName,
                              }: {
    userEmail: string;
    fullName: string | null;
}) {
    const pathname = usePathname();

    const isActive = (href: string, exact?: boolean) =>
        exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

    return (
        <div className="lg:sticky lg:top-24 space-y-10">
            {/* Identité user */}
            <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Mon compte
                </p>
                <p className="mt-3 font-display text-xl tracking-tight leading-tight truncate">
                    {fullName ?? userEmail.split("@")[0]}
                </p>
                <p className="mt-1 text-xs text-muted-foreground truncate">
                    {userEmail}
                </p>
            </div>

            <SidebarGroup
                title="Mon profil"
                links={PROFIL_LINKS}
                isActive={isActive}
            />

            <SidebarGroup
                title="Marketplace"
                links={MARKETPLACE_LINKS}
                isActive={isActive}
            />
        </div>
    );
}

function SidebarGroup({
                          title,
                          links,
                          isActive,
                      }: {
    title: string;
    links: Link[];
    isActive: (href: string, exact?: boolean) => boolean;
}) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
                {title}
            </p>
            <nav className="flex flex-col -ml-px">
                {links.map((link) => {
                    const active = isActive(link.href, link.exact);
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`text-sm py-2 pl-4 border-l transition-colors ${
                                active
                                    ? "text-foreground border-accent font-medium"
                                    : "text-muted-foreground border-border hover:text-foreground hover:border-foreground"
                            }`}
                        >
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}