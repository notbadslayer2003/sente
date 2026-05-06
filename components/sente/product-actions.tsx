"use client";

import {useState, useTransition} from "react";
import type { ProductVariant } from "@/lib/dal/products";
import { formatPriceEur } from "@/lib/utils/format";
import {useRouter} from "next/navigation";
import {addToCartAction} from "@/app/actions/cart";

type Props = {
    variant: ProductVariant | null;
    productOrgSlug: string;
    productSlug: string;
};

export function ProductActions({ variant }: Props) {
    const [quantity, setQuantity] = useState(1);

    if (!variant) {
        return (
            <div className="border border-dashed border-border p-6">
                <p className="text-xs text-muted-foreground">
                    Ce produit n'a pas de variante disponible.
                </p>
            </div>
        );
    }

    const isOutOfStock =
        variant.stock_quantity !== null && variant.stock_quantity === 0;
    const isLimitedStock =
        variant.stock_quantity !== null &&
        variant.stock_quantity > 0 &&
        variant.stock_quantity <= 5;

    const maxQty =
        variant.stock_quantity === null
            ? 99
            : Math.min(variant.stock_quantity, 99);

    // Reco Q4 — Indicatif sauf rupture, FOMO doux quand <= 5
    const stockLabel = isOutOfStock
        ? "Rupture"
        : isLimitedStock
            ? `Plus que ${variant.stock_quantity}`
            : variant.stock_quantity === null
                ? "Disponible"
                : "Disponible";

    return (
        <div className="space-y-5 py-6 border-y border-border">
            {/* Prix */}
            <div className="flex items-baseline gap-3">
                <p className="font-display text-3xl tracking-tight">
                    {formatPriceEur(variant.price_cents, { showFree: false })}
                </p>
                {variant.compare_at_price_cents &&
                    variant.compare_at_price_cents > variant.price_cents && (
                        <p className="text-base text-muted-foreground line-through">
                            {formatPriceEur(variant.compare_at_price_cents, {
                                showFree: false,
                            })}
                        </p>
                    )}
            </div>

            {/* Stock indicator */}
            <p
                className={`text-xs uppercase tracking-wide ${
                    isOutOfStock
                        ? "text-destructive"
                        : isLimitedStock
                            ? "text-accent"
                            : "text-muted-foreground"
                }`}
            >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-2 align-middle" />
                {stockLabel}
            </p>

            {/* Sélecteur quantité + Bouton ajout panier */}
            {!isOutOfStock && (
                <AddToCartControls
                    variantId={variant.id}
                    maxQty={maxQty}
                />
            )}
        </div>
    );
}

function AddToCartControls({
                               variantId,
                               maxQty,
                           }: {
    variantId: string;
    maxQty: number;
}) {
    const router = useRouter();
    const [quantity, setQuantity] = useState(1);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const onAdd = () => {
        setError(null);
        setSuccess(false);

        const fd = new FormData();
        fd.set("product_variant_id", variantId);
        fd.set("quantity", String(quantity));

        startTransition(async () => {
            const r = await addToCartAction(fd);
            if (r.ok) {
                setSuccess(true);
                router.refresh(); // refresh le badge cart dans le header
                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-stretch gap-3">
                <div className="flex items-center border border-border">
                    <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-3 py-3 text-sm hover:bg-accent/10 transition-colors"
                        aria-label="Réduire la quantité"
                        disabled={quantity <= 1 || isPending}
                    >
                        −
                    </button>
                    <span className="px-4 py-3 text-sm min-w-[40px] text-center">
                        {quantity}
                    </span>
                    <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                        className="px-3 py-3 text-sm hover:bg-accent/10 transition-colors"
                        aria-label="Augmenter la quantité"
                        disabled={quantity >= maxQty || isPending}
                    >
                        +
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onAdd}
                    disabled={isPending}
                    className="flex-1 px-6 py-3 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                    {isPending ? "Ajout..." : success ? "Ajouté ✓" : "Ajouter au panier"}
                </button>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}