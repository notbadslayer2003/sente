"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useTransition } from "react";
import {
    User, Settings, Heart, Calendar, ShoppingBag, LogOut, ChevronRight,
} from "lucide-react";
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
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const handleLogout = () => {
        startTransition(async () => { await logoutAction(); });
    };

    const initials = (displayName ?? email)
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    const firstName = displayName?.split(" ")[0];

    return (
        <div ref={ref} className="relative">
            {/* Avatar bouton */}
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
                <div className="absolute right-0 top-full mt-2 w-72 bg-background border border-border shadow-lg z-50">

                    {/* Identité */}
                    <div className="px-5 py-4 flex items-center gap-3 border-b border-border">
                        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-accent/10 text-accent text-xs font-medium uppercase tracking-wider">
                            {initials || "?"}
                        </div>
                        <div className="min-w-0">
                            {firstName && (
                                <p className="font-display text-base leading-tight truncate">
                                    {displayName}
                                </p>
                            )}
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {email}
                            </p>
                        </div>
                    </div>

                    {/* Navigation principale */}
                    <div className="py-1.5">
                        <MenuLink href="/profil" icon={User} onClick={() => setOpen(false)}>
                            Mon profil
                        </MenuLink>
                        <MenuLink href="/profil/commandes" icon={ShoppingBag} onClick={() => setOpen(false)}>
                            Mes commandes
                        </MenuLink>
                        <MenuLink href="/profil/inscriptions" icon={Calendar} onClick={() => setOpen(false)}>
                            Mes inscriptions
                        </MenuLink>
                        <MenuLink href="/profil/suivis" icon={Heart} onClick={() => setOpen(false)}>
                            Mes suivis
                        </MenuLink>
                    </div>

                    {/* Séparateur + Paramètres */}
                    <div className="border-t border-border py-1.5">
                        <MenuLink href="/profil/parametres" icon={Settings} onClick={() => setOpen(false)}>
                            Paramètres
                        </MenuLink>
                    </div>

                    {/* Déconnexion */}
                    <div className="border-t border-border py-1.5">
                        <button
                            onClick={handleLogout}
                            disabled={isPending}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left group transition-colors hover:bg-destructive/5 disabled:opacity-50"
                        >
                            <LogOut
                                className="w-3.5 h-3.5 text-muted-foreground group-hover:text-destructive transition-colors flex-shrink-0"
                                strokeWidth={1.75}
                            />
                            <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground group-hover:text-destructive transition-colors">
                                {isPending ? "Déconnexion..." : "Se déconnecter"}
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function MenuLink({
                      href,
                      icon: Icon,
                      onClick,
                      children,
                  }: {
    href: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-accent/5"
        >
            <Icon
                className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0"
                strokeWidth={1.75}
            />
            <span className="flex-1 text-[11px] uppercase tracking-[0.15em] group-hover:text-accent transition-colors">
                {children}
            </span>
            <ChevronRight
                className="w-3 h-3 text-muted-foreground/40 group-hover:text-accent/60 transition-colors"
                strokeWidth={1.75}
            />
        </Link>
    );
}