"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";

export function UserMenu({
                             displayName,
                             email,
                         }: {
    displayName: string | null;
    email: string;
}) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const handleLogout = () => {
        startTransition(async () => {
            await logoutAction();
        });
    };

    const initials = (displayName ?? email)
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <div ref={ref} className="relative">
            {/* Trigger avatar */}
            <button
                onClick={() => setOpen((o) => !o)}
                aria-label="Menu utilisateur"
                aria-expanded={open}
                className={`w-8 h-8 flex items-center justify-center text-[11px] font-medium uppercase tracking-wider transition-colors ${
                    open
                        ? "bg-accent text-accent-foreground"
                        : "bg-accent/10 text-accent hover:bg-accent/20"
                }`}
            >
                {initials || "?"}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-background border border-border z-50">

                    {/* Header identité — sobre, pas d'avatar dupliqué */}
                    <div className="px-5 pt-5 pb-4 border-b border-border">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                            Connecté
                        </p>
                        <p className="mt-2 font-display text-lg tracking-tight leading-tight truncate">
                            {displayName ?? email.split("@")[0]}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                            {email}
                        </p>
                    </div>

                    {/* Navigation — style ProfilSidebar, border-l */}
                    <nav className="py-2">
                        <MenuLink href="/profil" onClick={() => setOpen(false)}>
                            Mon profil
                        </MenuLink>
                        <MenuLink href="/profil/commandes" onClick={() => setOpen(false)}>
                            Mes commandes
                        </MenuLink>
                        <MenuLink href="/profil/inscriptions" onClick={() => setOpen(false)}>
                            Mes inscriptions
                        </MenuLink>
                        <MenuLink href="/profil/suivis" onClick={() => setOpen(false)}>
                            Mes suivis
                        </MenuLink>
                        <MenuLink href="/profil/marketplace/annonces" onClick={() => setOpen(false)}>
                            Marketplace
                        </MenuLink>
                        <MenuLink href="/profil/parametres" onClick={() => setOpen(false)}>
                            Paramètres
                        </MenuLink>
                    </nav>

                    {/* Déconnexion */}
                    <div className="border-t border-border py-2">
                        <button
                            onClick={handleLogout}
                            disabled={isPending}
                            className="w-full text-left px-5 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                            {isPending ? "Déconnexion..." : "Se déconnecter"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function MenuLink({
                      href,
                      onClick,
                      children,
                  }: {
    href: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="block px-5 py-2 text-sm text-foreground/80 hover:text-accent hover:bg-accent/5 transition-colors"
        >
            {children}
        </Link>
    );
}