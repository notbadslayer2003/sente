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

type NavItem = {
    href: string;
    label: string;
};

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
                { href: base, label: "Vue d'ensemble" },
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

    return (
        <div className="space-y-8">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    {orgType === "etang" ? "Étang" : "Magasin"}
                </p>
                <h2 className="mt-2 font-display text-2xl tracking-tight leading-tight">
                    {orgName}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={orgStatus} />
                    <span className="text-muted-foreground uppercase tracking-wide">
                        · {role}
                    </span>
                </div>
            </div>

            <nav className="space-y-6">
                {sections.map((section) => (
                    <div key={section.title}>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70 px-3 mb-2">
                            {section.title}
                        </p>
                        <ul className="space-y-0.5">
                            {section.items.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            className={`block px-3 py-2 text-sm transition-colors ${
                                                isActive
                                                    ? "bg-accent/10 text-accent font-medium"
                                                    : "text-foreground/80 hover:text-accent hover:bg-accent/5"
                                            }`}
                                        >
                                            {item.label}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

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