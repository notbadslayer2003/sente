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

    // Fermer le menu si clic en dehors
    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
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
            <button
                onClick={() => setOpen(!open)}
                className="w-9 h-9 flex items-center justify-center bg-accent/10 text-accent text-xs font-medium uppercase tracking-wide hover:bg-accent/20 transition-colors"
                aria-label="Menu utilisateur"
            >
                {initials || "?"}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-background border border-border shadow-md">
                    <div className="px-4 py-3 border-b border-border">
                        {displayName && (
                            <p className="font-display text-sm leading-tight">
                                {displayName}
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {email}
                        </p>
                    </div>

                    <ul className="py-2">
                        <MenuLink href="/profil" onClick={() => setOpen(false)}>
                            Mon profil
                        </MenuLink>
                        <MenuLink
                            href="/profil/suivis"
                            onClick={() => setOpen(false)}
                        >
                            Mes suivis
                        </MenuLink>
                        <MenuLink
                            href="/profil/inscriptions"
                            onClick={() => setOpen(false)}
                        >
                            Mes inscriptions
                        </MenuLink>
                        <MenuLink href="/profil/parametres" onClick={() => setOpen(false)}>
                            Paramètres
                        </MenuLink>
                    </ul>

                    <div className="border-t border-border py-2">
                        <button
                            onClick={handleLogout}
                            disabled={isPending}
                            className="w-full text-left px-4 py-2 text-sm uppercase tracking-wide text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
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
        <li>
            <Link
                href={href}
                onClick={onClick}
                className="block px-4 py-2 text-sm uppercase tracking-wide hover:text-accent hover:bg-accent/5 transition-colors"
            >
                {children}
            </Link>
        </li>
    );
}