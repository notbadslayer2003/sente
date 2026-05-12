"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// ButtonSente
//
// Reproduction fidèle du <Button /> du design Claude (shared.jsx) :
// - 4 variantes (kind) : primary, green, ghost, light
// - 3 tailles (size)   : sm, md, lg
// - Radius full, border 1px, gap interne 6px pour icône+label
//
// Pourquoi pas shadcn <Button /> ? shadcn a un radius variable et
// une palette différente. On garde shadcn pour les surfaces "app"
// (dashboard, formulaires) et ButtonSente pour les surfaces
// "design" (marketing, homepage, marketplace public).
//
// Sécurité : composant pur visuel, pas de logique d'action.
// ============================================================

type ButtonKind = "primary" | "green" | "ghost" | "light";
type ButtonSize = "sm" | "md" | "lg";

const KIND_CLASSES: Record<ButtonKind, string> = {
    // primary = fond noir, hover plus doux (ink2)
    primary: "bg-ink text-white border-ink hover:bg-ink2 hover:border-ink2",
    // green = CTA marketing principal
    green: "bg-green text-white border-green hover:bg-green-d hover:border-green-d",
    // ghost = pas de fond, bordure pâle qui se renforce au hover
    ghost: "bg-transparent text-ink border-line hover:border-ink",
    // light = surface blanche sur fond chaud
    light: "bg-white text-ink border-line hover:border-ink",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: "px-3.5 py-2 text-[13px]",
    md: "px-5 py-3 text-sm",
    lg: "px-6 py-3.5 text-[15px]",
};

const BASE_CLASSES =
    "inline-flex items-center justify-center gap-1.5 rounded-full border font-medium " +
    "no-underline cursor-pointer select-none " +
    "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * Helper exporté : retourne uniquement les classes Tailwind du bouton.
 * À utiliser sur un <Link> Next ou un <a> quand on a besoin d'un
 * bouton-lien (cas typique : "Inscription" dans la navbar).
 */
export function buttonSenteClasses({
                                       kind = "primary",
                                       size = "md",
                                       className,
                                   }: {
    kind?: ButtonKind;
    size?: ButtonSize;
    className?: string;
} = {}) {
    return cn(BASE_CLASSES, KIND_CLASSES[kind], SIZE_CLASSES[size], className);
}

export type ButtonSenteProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    kind?: ButtonKind;
    size?: ButtonSize;
};

export const ButtonSente = React.forwardRef<HTMLButtonElement, ButtonSenteProps>(
    ({ className, kind = "primary", size = "md", type = "button", ...props }, ref) => {
        return (
            <button
                ref={ref}
                type={type}
                className={buttonSenteClasses({ kind, size, className })}
                {...props}
            />
        );
    }
);
ButtonSente.displayName = "ButtonSente";