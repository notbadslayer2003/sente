"use client";

import { useMemo, useState } from "react";
import type { ProductVariant } from "@/lib/dal/products";

type Props = {
    dimensions: string[];
    variants: ProductVariant[];
    selectedVariantId: string | null;
    onSelect: (variantId: string) => void;
};

type ValueStatus = "selected" | "available" | "incompatible" | "out_of_stock" | "disabled";

export function VariantSelector({ dimensions, variants, selectedVariantId, onSelect }: Props) {
    const selectedVariant = variants.find((v) => v.id === selectedVariantId);
    const [adjustedDims, setAdjustedDims] = useState<string[]>([]);

    const valuesByDimension = useMemo(() => {
        const map: Record<string, string[]> = {};
        for (const dim of dimensions) {
            const seen = new Set<string>();
            for (const v of variants) {
                const val = v.options[dim];
                if (val) seen.add(val);
            }
            map[dim] = Array.from(seen).sort();
        }
        return map;
    }, [dimensions, variants]);

    /**
     * 4 états possibles pour une valeur dans une dimension :
     *
     * selected      → variante sélectionnée a cette valeur
     * available     → existe en stock avec les sélections actuelles
     * incompatible  → existe globalement mais pas avec la combo actuelle
     *                 (cliquable — les autres dims s'ajustent auto)
     * out_of_stock  → existe avec la combo actuelle mais en rupture
     * disabled      → n'existe dans aucune variante (ne devrait pas arriver)
     */
    const getValueStatus = (dim: string, value: string): ValueStatus => {
        if (selectedVariant?.options[dim] === value) return "selected";

        const allMatching = variants.filter((v) => v.options[dim] === value);
        if (allMatching.length === 0) return "disabled";

        // Compatibilité avec les autres dimensions actuellement sélectionnées
        const otherSelected: Record<string, string> = {};
        for (const d of dimensions) {
            if (d === dim) continue;
            const val = selectedVariant?.options[d];
            if (val) otherSelected[d] = val;
        }

        const comboMatching = allMatching.filter((v) =>
            Object.entries(otherSelected).every(([k, val]) => v.options[k] === val)
        );

        if (comboMatching.length === 0) return "incompatible"; // existe mais pas dans cette combo

        const inStock = comboMatching.some(
            (v) => v.stock_quantity === null || v.stock_quantity > 0
        );
        return inStock ? "available" : "out_of_stock";
    };

    const onValueClick = (dim: string, value: string) => {
        if (selectedVariant?.options[dim] === value) return;

        const target: Record<string, string> = { [dim]: value };
        for (const d of dimensions) {
            if (d === dim) continue;
            const current = selectedVariant?.options[d];
            if (current) target[d] = current;
        }

        // 1. Match exact — combo parfaite, aucun ajustement
        const exactMatch = variants.find((v) =>
            Object.entries(target).every(([k, val]) => v.options[k] === val)
        );
        if (exactMatch) {
            setAdjustedDims([]);
            onSelect(exactMatch.id);
            return;
        }

        // 2. Pas de match exact : on cherche le meilleur partiel
        // On identifie quelles dimensions devront changer
        const partialMatches = variants.filter((v) => v.options[dim] === value);
        const inStockMatch = partialMatches.find(
            (v) => v.stock_quantity === null || v.stock_quantity > 0
        ) ?? partialMatches[0];

        if (inStockMatch) {
            // Quelles dims ont changé par rapport à la sélection précédente ?
            const changed: string[] = [];
            for (const d of dimensions) {
                if (d === dim) continue;
                if (
                    selectedVariant?.options[d] &&
                    inStockMatch.options[d] !== selectedVariant.options[d]
                ) {
                    changed.push(d);
                }
            }
            setAdjustedDims(changed);
            onSelect(inStockMatch.id);
        }
    };

    return (
        <div className="space-y-5">
            {dimensions.map((dim) => {
                const values = valuesByDimension[dim] ?? [];

                return (
                    <div key={dim}>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
                            {dim}
                            {selectedVariant?.options[dim] && (
                                <span className="ml-2 text-foreground normal-case tracking-normal">
                                    : {selectedVariant.options[dim]}
                                </span>
                            )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {values.map((val) => {
                                const status = getValueStatus(dim, val);

                                return (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => onValueClick(dim, val)}
                                        disabled={status === "disabled"}
                                        aria-pressed={status === "selected"}
                                        title={
                                            status === "incompatible"
                                                ? `${val} n'existe pas avec ta sélection actuelle — les autres options s'adapteront`
                                                : status === "out_of_stock"
                                                    ? `${val} — rupture de stock`
                                                    : undefined
                                        }
                                        className={`relative px-4 py-2 text-xs uppercase tracking-wide border transition-all ${
                                            status === "selected"
                                                ? "border-accent bg-accent text-accent-foreground"
                                                : status === "disabled"
                                                    ? "border-border text-muted-foreground/30 line-through cursor-not-allowed"
                                                    : status === "incompatible"
                                                        ? "border-dashed border-border text-muted-foreground hover:border-accent/60 hover:text-foreground cursor-pointer"
                                                        : status === "out_of_stock"
                                                            ? "border-border text-muted-foreground hover:border-accent/50"
                                                            : "border-border hover:border-accent hover:text-accent"
                                        }`}
                                    >
                                        {val}
                                        {status === "out_of_stock" && (
                                            <span className="absolute -top-1 -right-1 px-1 text-[8px] bg-destructive text-destructive-foreground uppercase tracking-wide">
                                                Rupture
                                            </span>
                                        )}
                                        {status === "incompatible" && (
                                            <span className="absolute -top-1 -right-1 px-1 text-[8px] bg-muted text-muted-foreground uppercase tracking-wide">
                                                ~
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* Message contextuel quand l'auto-sélection a ajusté d'autres dimensions */}
            {adjustedDims.length > 0 && (
                <p className="text-[11px] text-muted-foreground border border-border px-3 py-2">
                    Cette combinaison n'existe pas — on a ajusté{" "}
                    <span className="text-foreground">
                        {adjustedDims.join(", ")}
                    </span>{" "}
                    pour la variante la plus proche.
                </p>
            )}
        </div>
    );
}