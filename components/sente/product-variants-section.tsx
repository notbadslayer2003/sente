"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import {
    addVariantAction,
    updateVariantAction,
    removeVariantAction,
} from "@/app/actions/product-variants";
import { updateProductInfoAction } from "@/app/actions/products";
import type { ProductDetail, ProductVariant } from "@/lib/dal/products";
import {
    formatPriceEur,
    centsToEurInput,
    eurStringToCents,
} from "@/lib/utils/format";

type Props = {
    product: ProductDetail;
    onMutated: () => void;
    canUseVariants: boolean;
    variantsReason: string | null;
    slug: string;
};

export function ProductVariantsSection({
                                           product,
                                           onMutated,
                                           canUseVariants,
                                           variantsReason,
                                           slug,
                                       }: Props) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const isGiftCard = product.kind === "gift_card";
    const dimensions =
        isGiftCard && product.variant_dimensions.length === 0
            ? ["Valeur"]
            : product.variant_dimensions;
    const sortedVariants = [...product.variants].sort(
        (a, b) => a.display_order - b.display_order
    );

    const onRemove = (variantId: string) => {
        if (!confirm("Supprimer cette variante ?")) return;
        const fd = new FormData();
        fd.set("variant_id", variantId);
        startTransition(async () => {
            setError(null);
            const r = await removeVariantAction(fd);
            if (r.ok) onMutated();
            else setError(r.error);
        });
    };

    return (
        <div className="space-y-6">
            {/* ------------------------------------------------------------------ */}
            {/* Types d'options — visible seulement pour les produits non gift_card */}
            {/* ------------------------------------------------------------------ */}
            {!isGiftCard && (
                <DimensionsConfig
                    product={product}
                    canUseVariants={canUseVariants}
                    variantsReason={variantsReason}
                    slug={slug}
                    onSaved={onMutated}
                />
            )}

            {error && (
                <div className="border border-destructive bg-destructive/5 p-3">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* Tableau des variantes existantes                                    */}
            {/* ------------------------------------------------------------------ */}
            {sortedVariants.length === 0 ? (
                <div className="border border-dashed border-border p-8 text-center">
                    <p className="text-xs text-muted-foreground">
                        Aucune variante. Ajoute-en une pour pouvoir publier le produit.
                    </p>
                </div>
            ) : (
                <div className="border border-border">
                    <table className="w-full">
                        <thead>
                        <tr className="border-b border-border bg-secondary/20">
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                SKU
                            </th>
                            {dimensions.map((d) => (
                                <th
                                    key={d}
                                    className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal"
                                >
                                    {d}
                                </th>
                            ))}
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                Prix
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                Stock
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                Actif
                            </th>
                            <th className="text-right p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                Actions
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {sortedVariants.map((v) =>
                            editingId === v.id ? (
                                <VariantEditRow
                                    key={v.id}
                                    variant={v}
                                    dimensions={dimensions}
                                    onCancel={() => setEditingId(null)}
                                    onSaved={() => {
                                        setEditingId(null);
                                        onMutated();
                                    }}
                                />
                            ) : (
                                <VariantReadRow
                                    key={v.id}
                                    variant={v}
                                    dimensions={dimensions}
                                    onEdit={() => setEditingId(v.id)}
                                    onRemove={() => onRemove(v.id)}
                                    canRemove={sortedVariants.length > 1}
                                    isPending={isPending}
                                />
                            )
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* Ajouter une variante                                                */}
            {/* ------------------------------------------------------------------ */}
            {showAddForm ? (
                <VariantAddForm
                    productId={product.id}
                    dimensions={dimensions}
                    onCancel={() => setShowAddForm(false)}
                    onAdded={() => {
                        setShowAddForm(false);
                        onMutated();
                    }}
                />
            ) : canUseVariants ? (
                <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full px-4 py-3 text-xs uppercase tracking-wide border border-dashed border-border hover:bg-accent/5 hover:border-accent transition-colors"
                >
                    + Ajouter une variante
                </button>
            ) : (
                <Link
                    href={`/dashboard/${slug}/parametres`}
                    title={variantsReason ?? ""}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-wide border border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                >
                    <Lock className="w-3 h-3" strokeWidth={1.75} />
                    {variantsReason ?? "Variantes multiples — Upgrade"}
                </Link>
            )}
        </div>
    );
}

// =============================================================================
// Types d'options (ex-"Dimensions de variation")
// =============================================================================

function DimensionsConfig({
                              product,
                              canUseVariants,
                              variantsReason,
                              slug,
                              onSaved,
                          }: {
    product: ProductDetail;
    canUseVariants: boolean;
    variantsReason: string | null;
    slug: string;
    onSaved: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [dimensions, setDimensions] = useState<string[]>(
        product.variant_dimensions
    );
    const [dimInput, setDimInput] = useState("");

    const addDimension = () => {
        const d = dimInput.trim();
        if (!d) return;
        if (dimensions.includes(d)) return;
        if (dimensions.length >= 3) {
            setError("Maximum 3 types d'options");
            return;
        }
        setDimensions([...dimensions, d]);
        setDimInput("");
    };

    const onSave = () => {
        setError(null);
        setSuccess(false);

        // On appelle updateProductInfoAction en passant toutes les infos existantes
        // du produit inchangées — seules les dimensions varient.
        const fd = new FormData();
        fd.set("product_id", product.id);
        fd.set("category_id", product.category.id);
        fd.set("name", product.name);
        fd.set("short_desc", product.short_desc ?? "");
        fd.set("full_desc", product.full_desc ?? "");
        fd.set("brand", product.brand ?? "");
        fd.set("tags", JSON.stringify(product.tags));
        fd.set("variant_dimensions", JSON.stringify(dimensions));

        startTransition(async () => {
            const r = await updateProductInfoAction(fd);
            if (r.ok) {
                setSuccess(true);
                onSaved();
                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError(r.error);
            }
        });
    };

    const hasChanged =
        JSON.stringify(dimensions.sort()) !==
        JSON.stringify([...product.variant_dimensions].sort());

    const hasVariantsWithOptions = product.variants.some(
        (v) => Object.keys(v.options).length > 0
    );

    return (
        <div className="border border-border p-5 space-y-4">
            <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Types d'options
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                    Définit selon quels axes ton produit se décline. Ex : Taille,
                    Couleur, Puissance de ligne. Laisse vide si ton produit n'a qu'une
                    seule version.
                </p>
            </div>

            {/* Si Starter : on bloque avec un message clair */}
            {!canUseVariants ? (
                <div className="border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
                    <Lock
                        className="w-4 h-4 text-accent shrink-0 mt-0.5"
                        strokeWidth={1.75}
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed">
                            {variantsReason ??
                                "Les types d'options sont disponibles à partir du plan Pro."}
                        </p>
                        <Link
                            href={`/dashboard/${slug}/parametres`}
                            className="mt-2 inline-block text-[11px] uppercase tracking-wide text-accent border-b border-accent hover:opacity-70 transition-opacity"
                        >
                            Voir les plans →
                        </Link>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2">
                        {dimensions.map((d) => (
                            <span
                                key={d}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-accent/10 text-accent text-xs"
                            >
                                {d}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDimensions(dimensions.filter((x) => x !== d))
                                    }
                                    className="hover:text-destructive transition-colors"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        {dimensions.length === 0 && (
                            <span className="text-xs text-muted-foreground italic">
                                Aucun type d'option — variante unique.
                            </span>
                        )}
                    </div>

                    {dimensions.length < 3 && (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={dimInput}
                                onChange={(e) => setDimInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addDimension();
                                    }
                                }}
                                placeholder="ex : Taille, Couleur, Puissance..."
                                maxLength={40}
                                className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={addDimension}
                                className="px-3 py-2 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                            >
                                Ajouter
                            </button>
                        </div>
                    )}

                    {hasChanged && hasVariantsWithOptions && (
                        <p className="text-xs text-destructive">
                            ⚠ Tu modifies les types d'options alors que des variantes
                            existantes utilisent déjà des options. Vérifie leur cohérence
                            après l'enregistrement.
                        </p>
                    )}

                    {error && <p className="text-xs text-destructive">{error}</p>}
                    {success && (
                        <p className="text-xs text-primary">Types d'options enregistrés.</p>
                    )}

                    {hasChanged && (
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={isPending}
                            className="px-4 py-2 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                        >
                            {isPending ? "Enregistrement..." : "Enregistrer les types d'options"}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

// =============================================================================
// Ligne en lecture
// =============================================================================

function VariantReadRow({
                            variant,
                            dimensions,
                            onEdit,
                            onRemove,
                            canRemove,
                            isPending,
                        }: {
    variant: ProductVariant;
    dimensions: string[];
    onEdit: () => void;
    onRemove: () => void;
    canRemove: boolean;
    isPending: boolean;
}) {
    return (
        <tr className="border-b border-border last:border-0 hover:bg-secondary/10 transition-colors">
            <td className="p-3 text-sm font-mono">{variant.sku}</td>
            {dimensions.map((d) => (
                <td key={d} className="p-3 text-sm">
                    {variant.options[d] ?? (
                        <span className="text-muted-foreground italic">—</span>
                    )}
                </td>
            ))}
            <td className="p-3 text-sm">
                {formatPriceEur(variant.price_cents, { showFree: false })}
                {variant.compare_at_price_cents && (
                    <span className="ml-2 text-xs text-muted-foreground line-through">
                        {formatPriceEur(variant.compare_at_price_cents, {
                            showFree: false,
                        })}
                    </span>
                )}
            </td>
            <td className="p-3 text-sm">
                {variant.stock_quantity === null ? (
                    <span className="text-muted-foreground">∞</span>
                ) : variant.stock_quantity === 0 ? (
                    <span className="text-destructive">Rupture</span>
                ) : (
                    variant.stock_quantity
                )}
            </td>
            <td className="p-3">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        variant.is_active ? "bg-primary" : "bg-muted"
                    }`}
                    title={variant.is_active ? "Active" : "Inactive"}
                />
            </td>
            <td className="p-3 text-right">
                <button
                    onClick={onEdit}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-accent transition-colors disabled:opacity-50"
                >
                    Modifier
                </button>
                {canRemove && (
                    <button
                        onClick={onRemove}
                        disabled={isPending}
                        className="ml-3 text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                        Supprimer
                    </button>
                )}
            </td>
        </tr>
    );
}

// =============================================================================
// Ligne en édition (inline)
// =============================================================================

function VariantEditRow({
                            variant,
                            dimensions,
                            onCancel,
                            onSaved,
                        }: {
    variant: ProductVariant;
    dimensions: string[];
    onCancel: () => void;
    onSaved: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [sku, setSku] = useState(variant.sku);
    const [priceEur, setPriceEur] = useState(centsToEurInput(variant.price_cents));
    const [compareAtEur, setCompareAtEur] = useState(
        variant.compare_at_price_cents
            ? centsToEurInput(variant.compare_at_price_cents)
            : ""
    );
    const [stock, setStock] = useState<string>(
        variant.stock_quantity === null ? "" : String(variant.stock_quantity)
    );
    const [unlimited, setUnlimited] = useState(variant.stock_quantity === null);
    const [isActive, setIsActive] = useState(variant.is_active);

    const onSave = () => {
        setError(null);

        const priceCents = eurStringToCents(priceEur);
        if (priceCents === null || priceCents === 0) {
            setError("Prix invalide");
            return;
        }

        let compareAtCents: number | null = null;
        if (compareAtEur.trim() !== "") {
            const c = eurStringToCents(compareAtEur);
            if (c === null) {
                setError("Prix barré invalide");
                return;
            }
            compareAtCents = c;
        }

        let stockValue: number | null = null;
        if (!unlimited) {
            const n = parseInt(stock, 10);
            if (!Number.isFinite(n) || n < 0) {
                setError("Stock invalide");
                return;
            }
            stockValue = n;
        }

        const fd = new FormData();
        fd.set("variant_id", variant.id);
        fd.set("sku", sku);
        fd.set("price_cents", String(priceCents));
        fd.set(
            "compare_at_price_cents",
            compareAtCents === null ? "null" : String(compareAtCents)
        );
        fd.set("stock_quantity", stockValue === null ? "null" : String(stockValue));
        fd.set("is_active", String(isActive));

        startTransition(async () => {
            const r = await updateVariantAction(fd);
            if (r.ok) onSaved();
            else setError(r.error);
        });
    };

    return (
        <>
            <tr className="border-b-0 bg-accent/5">
                <td className="p-3">
                    <input
                        type="text"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        maxLength={64}
                        className="w-full bg-background border border-border px-2 py-1 text-xs font-mono focus:border-accent focus:outline-none"
                    />
                </td>
                {dimensions.map((d) => (
                    <td key={d} className="p-3 text-xs text-muted-foreground italic">
                        {variant.options[d] ?? "—"}
                    </td>
                ))}
                <td className="p-3">
                    <div className="space-y-1">
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={priceEur}
                                onChange={(e) => setPriceEur(e.target.value)}
                                placeholder="0.00"
                                className="w-24 bg-background border border-border pl-2 pr-6 py-1 text-xs focus:border-accent focus:outline-none"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                €
                            </span>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={compareAtEur}
                                onChange={(e) => setCompareAtEur(e.target.value)}
                                placeholder="(barré)"
                                className="w-24 bg-background border border-border pl-2 pr-6 py-1 text-xs focus:border-accent focus:outline-none"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                €
                            </span>
                        </div>
                    </div>
                </td>
                <td className="p-3">
                    <div className="space-y-1">
                        <input
                            type="number"
                            min={0}
                            value={stock}
                            onChange={(e) => setStock(e.target.value)}
                            disabled={unlimited}
                            placeholder="0"
                            className="w-20 bg-background border border-border px-2 py-1 text-xs focus:border-accent focus:outline-none disabled:opacity-50"
                        />
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                            <input
                                type="checkbox"
                                checked={unlimited}
                                onChange={(e) => setUnlimited(e.target.checked)}
                                className="w-3 h-3 accent-accent cursor-pointer"
                            />
                            Illimité
                        </label>
                    </div>
                </td>
                <td className="p-3">
                    <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="w-4 h-4 accent-accent cursor-pointer"
                    />
                </td>
                <td className="p-3 text-right">
                    <button
                        onClick={onSave}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide text-accent hover:underline disabled:opacity-50"
                    >
                        {isPending ? "..." : "Enregistrer"}
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={isPending}
                        className="ml-3 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        Annuler
                    </button>
                </td>
            </tr>
            {error && (
                <tr>
                    <td
                        colSpan={5 + dimensions.length}
                        className="px-3 pb-3 text-xs text-destructive bg-accent/5"
                    >
                        {error}
                    </td>
                </tr>
            )}
        </>
    );
}

// =============================================================================
// Formulaire d'ajout
// =============================================================================

function VariantAddForm({
                            productId,
                            dimensions,
                            onCancel,
                            onAdded,
                        }: {
    productId: string;
    dimensions: string[];
    onCancel: () => void;
    onAdded: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [sku, setSku] = useState("");
    const [priceEur, setPriceEur] = useState("");
    const [stock, setStock] = useState("0");
    const [unlimited, setUnlimited] = useState(false);
    const [optionValues, setOptionValues] = useState<Record<string, string>>(
        Object.fromEntries(dimensions.map((d) => [d, ""]))
    );

    const onSubmit = () => {
        setError(null);

        const priceCents = eurStringToCents(priceEur);
        if (priceCents === null || priceCents === 0) {
            setError("Prix invalide");
            return;
        }
        if (!sku.trim()) {
            setError("SKU requis");
            return;
        }

        for (const d of dimensions) {
            if (!optionValues[d]?.trim()) {
                setError(`Valeur manquante pour "${d}"`);
                return;
            }
        }

        let stockValue: number | null = null;
        if (!unlimited) {
            const n = parseInt(stock, 10);
            if (!Number.isFinite(n) || n < 0) {
                setError("Stock invalide");
                return;
            }
            stockValue = n;
        }

        const fd = new FormData();
        fd.set("product_id", productId);
        fd.set("sku", sku.trim());
        fd.set("price_cents", String(priceCents));
        fd.set("stock_quantity", stockValue === null ? "null" : String(stockValue));
        fd.set("options", JSON.stringify(optionValues));

        startTransition(async () => {
            const r = await addVariantAction(fd);
            if (r.ok) onAdded();
            else setError(r.error);
        });
    };

    return (
        <div className="border border-accent bg-accent/5 p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium uppercase tracking-wide">
                    Nouvelle variante
                </h4>
                <button
                    onClick={onCancel}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                    Annuler
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SmallField label="SKU" required>
                    <input
                        type="text"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        maxLength={64}
                        placeholder="ex: KORDA-12FT-3LB"
                        className="w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none"
                    />
                </SmallField>

                <SmallField label="Prix TTC" required>
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="decimal"
                            value={priceEur}
                            onChange={(e) => setPriceEur(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-background border border-border pl-3 pr-10 py-2 text-sm focus:border-accent focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            €
                        </span>
                    </div>
                </SmallField>

                <SmallField label="Stock initial">
                    <div className="space-y-2">
                        <input
                            type="number"
                            min={0}
                            value={stock}
                            onChange={(e) => setStock(e.target.value)}
                            disabled={unlimited}
                            className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <input
                                type="checkbox"
                                checked={unlimited}
                                onChange={(e) => setUnlimited(e.target.checked)}
                                className="w-3 h-3 accent-accent cursor-pointer"
                            />
                            Stock illimité
                        </label>
                    </div>
                </SmallField>
            </div>

            {dimensions.length > 0 && (
                <div className="border-t border-accent/30 pt-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
                        Options
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {dimensions.map((d) => (
                            <SmallField key={d} label={d} required>
                                <input
                                    type="text"
                                    value={optionValues[d] ?? ""}
                                    onChange={(e) =>
                                        setOptionValues({
                                            ...optionValues,
                                            [d]: e.target.value,
                                        })
                                    }
                                    placeholder={`ex: 12ft, Rouge, 3lb...`}
                                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                />
                            </SmallField>
                        ))}
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end">
                <button
                    onClick={onSubmit}
                    disabled={isPending}
                    className="px-4 py-2 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                    {isPending ? "Ajout..." : "Ajouter la variante"}
                </button>
            </div>
        </div>
    );
}

function SmallField({
                        label,
                        required,
                        children,
                    }: Readonly<{
    label: string;
    required?: boolean;
    children: React.ReactNode;
}>) {
    return (
        <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </span>
            <div className="mt-1.5">{children}</div>
        </label>
    );
}