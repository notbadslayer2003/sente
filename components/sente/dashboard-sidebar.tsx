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

export function DashboardSidebar({
                                     slug,
                                     orgName,
                                     orgType,
                                     orgStatus,
                                     role,
                                 }: Props) {
    const pathname = usePathname();
    const base = `/dashboard/${slug}`;

    const items = [
        { href: base, label: "Vue d'ensemble" },
        { href: `${base}/fiche`, label: "Fiche publique" },
        { href: `${base}/photos`, label: "Photos" },
        ...(orgType === "etang"
            ? [
                { href: `${base}/postes`, label: "Postes" },
                { href: `${base}/registre`, label: "Registre pêcheurs" },
            ]
            : [
                { href: `${base}/produits`, label: "Produits", disabled: true },
                { href: `${base}/commandes`, label: "Commandes", disabled: true },
            ]),
        { href: `${base}/posts`, label: "Posts & événements", disabled: true },
        { href: `${base}/equipe`, label: "Équipe" },
        { href: `${base}/mentions`, label: "Mentions reçues" },
        { href: `${base}/paiements`, label: "Paiements" },
        { href: `${base}/paiements/historique`, label: "Historique paiements" },
        { href: `${base}/parametres`, label: "Paramètres", disabled: true },
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

            <nav>
                <ul className="space-y-1">
                    {items.map((item) => {
                        const isActive = pathname === item.href;
                        if (item.disabled) {
                            return (
                                <li key={item.href}>
                                    <span className="block px-3 py-2 text-sm uppercase tracking-wide text-muted-foreground/50 cursor-not-allowed">
                                        {item.label}
                                        <span className="ml-2 text-[9px] tracking-widest">
                      BIENTÔT
                    </span>
                                    </span>
                                </li>
                            );
                        }
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`block px-3 py-2 text-sm uppercase tracking-wide transition-colors ${
                                        isActive
                                            ? "bg-accent/10 text-accent"
                                            : "text-foreground/80 hover:text-accent hover:bg-accent/5"
                                    }`}
                                >
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
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

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; className: string }> = {
        draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
        pending_review: {
            label: "En validation",
            className: "bg-accent/15 text-accent",
        },
        active: { label: "Actif", className: "bg-primary/15 text-primary" },
        suspended: { label: "Suspendu", className: "bg-destructive/15 text-destructive" },
        banned: { label: "Banni", className: "bg-destructive/15 text-destructive" },
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