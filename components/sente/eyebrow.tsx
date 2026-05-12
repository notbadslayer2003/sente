import * as React from "react";
import { cn } from "@/lib/utils";

// ============================================================
// Eyebrow
//
// Petit label avant un h1/h2 : uppercase, letter-spacing fort,
// taille 12px, weight 500. Utilisé partout dans le design Claude :
// hero, sections marketplace, three uses, etc.
//
// Variantes de couleur :
// - default (gris doux sur fond clair)
// - light (utilisé sur fond image : white/85)
// ============================================================

type EyebrowVariant = "default" | "light";

const VARIANT_CLASSES: Record<EyebrowVariant, string> = {
    default: "text-mute",
    light: "text-white/[0.92]",
};

export function Eyebrow({
                            children,
                            variant = "default",
                            className,
                            as: As = "div",
                        }: {
    children: React.ReactNode;
    variant?: EyebrowVariant;
    className?: string;
    as?: React.ElementType;
}) {
    return (
        <As
            className={cn(
                "font-body text-[12px] font-medium uppercase tracking-[0.14em] leading-none",
                VARIANT_CLASSES[variant],
                className
            )}
        >
            {children}
        </As>
    );
}