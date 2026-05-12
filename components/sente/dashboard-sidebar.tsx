"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
    slug: string;
    orgName: string;
    orgType: "etang" | "magasin";
    orgStatus: string;
    role: "owner" | "admin" | "staff";
};

type NavItem = { href: string; label: string; exact?: boolean };

type NavSection = {
    title: string;
    items: NavItem[];
};

export function DashboardSidebar({
                                     slug,
                                     orgName,
                                     orgType,
                                     orgStatus,
                                     role,
                                 }: Readonly<Props>) {
    const pathname = usePathname();
    const base = `/dashboard/${slug}`;

    const sections: NavSection[] = [
        {
            title: "Présence",
            items: [
                { href: base, label: "Vue d'ensemble", exact: true },
                { href: `${base}/fiche`, label: "Fiche publique" },
                { href: `${base}/photos`, label: "Photos" },
            ],
        },
        {
            title: orgType === "etang" ? "Activité étang" : "Boutique",
            items:
                orgType === "etang"
                    ? [
                        { href: `${base}/postes`, label: "Postes" },
                        { href: `${base}/registre`, label: "Registre pêcheurs" },
                    ]
                    : [
                        { href: `${base}/produits`, label: "Produits" },
                        { href: `${base}/commandes`, label: "Commandes" },
                        { href: `${base}/boutique`, label: "Configuration" },
                    ],
        },
        {
            title: "Communauté",
            items: [
                { href: `${base}/posts`, label: "Posts" },
                { href: `${base}/evenements`, label: "Événements" },
                { href: `${base}/mentions`, label: "Mentions reçues" },
            ],
        },
        {
            title: "Finances",
            items: [{ href: `${base}/paiements`, label: "Paiements" }],
        },
        {
            title: "Compte",
            items: [
                { href: `${base}/equipe`, label: "Équipe" },
                { href: `${base}/parametres`, label: "Paramètres" },
            ],
        },
    ];

    const isActive = (href: string, exact?: boolean) =>
        exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

    const roleLabel: Record<typeof role, string> = {
        owner: "Propriétaire",
        admin: "Admin",
        staff: "Staff",
    };

    return (
        <div className="lg:sticky lg:top-24 space-y-10">
            {/* Identité organisation */}
            <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {orgType === "etang" ? "Étang" : "Magasin"}
                </p>
                <p className="mt-3 font-display text-xl tracking-tight leading-tight truncate">
                    {orgName}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={orgStatus} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {roleLabel[role]}
                    </span>
                </div>
            </div>

            {/* Sections de navigation */}
            {sections.map((section) => (
                <SidebarGroup
                    key={section.title}
                    title={section.title}
                    items={section.items}
                    isActive={isActive}
                />
            ))}

            {/* Footer */}
            <div className="pt-6 border-t border-border">
                <Link
                    href="/profil"
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-accent transition-colors"
                >
                    ← Retour au profil
                </Link>
            </div>
        </div>
    );
}

function SidebarGroup({
                          title,
                          items,
                          isActive,
                      }: {
    title: string;
    items: NavItem[];
    isActive: (href: string, exact?: boolean) => boolean;
}) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
                {title}
            </p>
            <nav className="flex flex-col -ml-px">
                {items.map((item) => {
                    const active = isActive(item.href, item.exact);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`text-sm py-2 pl-4 border-l transition-colors ${
                                active
                                    ? "text-foreground border-accent font-medium"
                                    : "text-muted-foreground border-border hover:text-foreground hover:border-foreground"
                            }`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}

function StatusBadge({ status }: Readonly<{ status: string }>) {
    const map: Record<string, { label: string; className: string }> = {
        draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
        pending_review: {
            label: "En validation",
            className: "bg-accent/15 text-accent",
        },
        active: { label: "Actif", className: "bg-primary/15 text-primary" },
        suspended: {
            label: "Suspendu",
            className: "bg-destructive/15 text-destructive",
        },
        banned: {
            label: "Banni",
            className: "bg-destructive/15 text-destructive",
        },
    };
    const variant = map[status] ?? map.draft;
    return (
        <span
            className={`px-2 py-0.5 text-[10px] uppercase tracking-wide ${variant.className}`}
        >
            {variant.label}
        </span>
    );
}