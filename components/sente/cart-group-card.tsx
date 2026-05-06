"use client";

import Link from "next/link";
import Image from "next/image";
import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {
    updateCartItemQuantityAction,
    removeCartItemAction,
    clearCartAction,
} from "@/app/actions/cart";
import {
    formatPriceEur,
    formatPriceRangeEur,
} from "@/lib/utils/format";
import type {CartGroup, CartItem} from "@/lib/dal/cart";
import {createShopCheckoutSessionAction} from "@/app/actions/checkout-shop";

type Props = {
    group: CartGroup;
};

const DELIVERY_OPTIONS: Array<{
    value: "click_collect" | "shipping_standard" | "shipping_local";
    label: string;
    description: string;
}> = [
    {
        value: "click_collect",
        label: "Retrait en magasin",
        description: "Gratuit. Tu seras prévenu(e) quand c'est prêt.",
    },
    {
        value: "shipping_standard",
        label: "Livraison standard",
        description: "Par transporteur (poste, GLS).",
    },
    {
        value: "shipping_local",
        label: "Livraison locale",
        description: "Le magasin livre directement.",
    },
];

export function CartGroupCard({group}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [deliveryMethod, setDeliveryMethod] = useState<
        "click_collect" | "shipping_standard" | "shipping_local" | null
    >(null);

    const onClearCart = () => {
        if (!confirm("Vider ce panier ?")) return;
        const fd = new FormData();
        fd.set("cart_id", group.cart_id);
        startTransition(async () => {
            setError(null);
            const r = await clearCartAction(fd);
            if (r.ok) router.refresh();
            else setError(r.error);
        });
    };

    const onCheckout = () => {
        if (!deliveryMethod) {
            setError("Choisis un mode de récupération.");
            return;
        }

        setError(null);
        const fd = new FormData();
        fd.set("cart_id", group.cart_id);
        fd.set("delivery_method", deliveryMethod);

        startTransition(async () => {
            const r = await createShopCheckoutSessionAction(fd);
            if (r.ok && r.data) {
                // Redirect vers Stripe
                window.location.href = r.data.url;
            } else if (!r.ok) {
                setError(r.error);
            }
        });
    };

    // Pas de checkout si problème
    const canCheckout =
        !group.has_unavailable_items &&
        group.organization.stripe_charges_enabled &&
        group.items.length > 0;

    return (
        <article className="border border-border">
            {/* Header magasin */}
            <header className="flex items-center justify-between gap-4 p-5 border-b border-border bg-secondary/20">
                <Link
                    href={`/magasins/${group.organization.slug}/boutique`}
                    className="flex items-center gap-3 group min-w-0"
                >
                    <div
                        className="w-10 h-10 bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                        {group.organization.cover_image_url ? (
                            <Image
                                src={group.organization.cover_image_url}
                                alt={group.organization.name}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-[8px] uppercase tracking-wide text-muted-foreground">
                                {group.organization.name.slice(0, 2)}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Magasin
                        </p>
                        <p className="text-sm font-medium group-hover:text-accent transition-colors truncate">
                            {group.organization.name}
                        </p>
                    </div>
                </Link>
                <button
                    type="button"
                    onClick={onClearCart}
                    disabled={isPending}
                    className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                    Vider
                </button>
            </header>

            {/* Warning si magasin pas onboardé Stripe */}
            {!group.organization.stripe_charges_enabled && (
                <div className="p-4 bg-destructive/5 border-b border-destructive/30">
                    <p className="text-xs text-destructive">
                        Ce magasin n'accepte pas encore les paiements en ligne. Tu ne peux
                        pas finaliser cette commande pour le moment.
                    </p>
                </div>
            )}

            {/* Liste items */}
            <ul className="divide-y divide-border">
                {group.items.map((item) => (
                    <li key={item.id}>
                        <CartItemRow
                            item={item}
                            orgSlug={group.organization.slug}
                        />
                    </li>
                ))}
            </ul>

            {/* Mode de récupération */}
            {canCheckout && (
                <div className="border-t border-border p-5 space-y-4 bg-secondary/10">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
                            Mode de récupération
                        </p>
                        <div className="space-y-2">
                            {DELIVERY_OPTIONS.map((opt) => (
                                <label
                                    key={opt.value}
                                    className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                                        deliveryMethod === opt.value
                                            ? "border-accent bg-accent/5"
                                            : "border-border hover:border-accent/50"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name={`delivery-${group.cart_id}`}
                                        value={opt.value}
                                        checked={deliveryMethod === opt.value}
                                        onChange={() => setDeliveryMethod(opt.value)}
                                        className="mt-1 accent-accent"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm">{opt.label}</p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {opt.description}
                                        </p>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="mt-3 text-[11px] text-muted-foreground">
                            Les frais exacts sont calculés sur la page de paiement selon
                            la config du magasin.
                        </p>
                    </div>
                </div>
            )}

            {/* Footer total + checkout */}
            <footer className="p-5 border-t border-border space-y-4">
                <div className="flex items-baseline justify-between gap-4">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Sous-total ({group.items_count} article
                        {group.items_count > 1 ? "s" : ""})
                    </span>
                    <span className="font-display text-2xl tracking-tight">
                        {formatPriceEur(group.subtotal_cents, {showFree: false})}
                    </span>
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}

                <button
                    type="button"
                    onClick={onCheckout}
                    disabled={isPending || !canCheckout}
                    className="w-full px-6 py-3 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {!group.organization.stripe_charges_enabled
                        ? "Paiement indisponible"
                        : group.has_unavailable_items
                            ? "Corrige le panier avant"
                            : "Passer la commande"}
                </button>
            </footer>
        </article>
    );
}

// =============================================================================
// Une ligne d'item (gestion quantité, suppression, alertes)
// =============================================================================

function CartItemRow({
                         item,
                         orgSlug,
                     }: {
    item: CartItem;
    orgSlug: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [localQty, setLocalQty] = useState(item.quantity);

    const cover = item.product.photos[0];
    const lineTotal = item.variant.price_cents * item.quantity;

    // Calcul des états d'indispo (mirroir de isItemUnavailable côté DAL)
    const isVariantInactive = !item.variant.is_active;
    const isProductDeleted = item.product.deleted_at !== null;
    const isProductUnpublished = item.product.status !== "published";
    const isStockInsufficient =
        item.variant.stock_quantity !== null &&
        item.variant.stock_quantity < item.quantity;
    const hasIssue =
        isVariantInactive ||
        isProductDeleted ||
        isProductUnpublished ||
        isStockInsufficient;

    const maxQty =
        item.variant.stock_quantity === null
            ? 99
            : Math.min(item.variant.stock_quantity, 99);

    const onUpdateQty = (newQty: number) => {
        if (newQty === item.quantity) return;
        setLocalQty(newQty);

        const fd = new FormData();
        fd.set("cart_item_id", item.id);
        fd.set("quantity", String(newQty));

        startTransition(async () => {
            setError(null);
            const r = await updateCartItemQuantityAction(fd);
            if (r.ok) {
                router.refresh();
            } else {
                setError(r.error);
                setLocalQty(item.quantity); // rollback UI
            }
        });
    };

    const onRemove = () => {
        const fd = new FormData();
        fd.set("cart_item_id", item.id);
        startTransition(async () => {
            setError(null);
            const r = await removeCartItemAction(fd);
            if (r.ok) router.refresh();
            else setError(r.error);
        });
    };

    return (
        <div className="p-4 flex gap-4">
            {/* Photo */}
            <Link
                href={`/magasins/${orgSlug}/boutique/${item.product.slug}`}
                className="flex-shrink-0 block w-20 h-20 sm:w-24 sm:h-24 bg-secondary border border-border overflow-hidden"
            >
                {cover ? (
                    <Image
                        src={cover}
                        alt={item.product.name}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[8px] uppercase tracking-wide text-muted-foreground">
                            Pas
                            <br/>
                            d'image
                        </span>
                    </div>
                )}
            </Link>

            {/* Détails */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <Link
                            href={`/magasins/${orgSlug}/boutique/${item.product.slug}`}
                            className="text-sm font-medium hover:text-accent transition-colors line-clamp-2"
                        >
                            {item.product.name}
                        </Link>
                        {item.product.brand && (
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
                                {item.product.brand}
                            </p>
                        )}
                        {Object.keys(item.variant.options).length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {Object.entries(item.variant.options)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(" · ")}
                            </p>
                        )}
                    </div>
                    <p className="text-sm font-medium whitespace-nowrap">
                        {formatPriceEur(lineTotal, {showFree: false})}
                    </p>
                </div>

                {/* Alertes */}
                {hasIssue && (
                    <div className="text-xs text-destructive">
                        {isProductDeleted || isProductUnpublished
                            ? "Ce produit n'est plus disponible."
                            : isVariantInactive
                                ? "Cette variante n'est plus disponible."
                                : isStockInsufficient
                                    ? `Plus que ${item.variant.stock_quantity} en stock.`
                                    : null}
                    </div>
                )}

                {/* Qty controls + remove */}
                <div className="flex items-center justify-between gap-3 mt-auto">
                    <div className="flex items-center border border-border">
                        <button
                            type="button"
                            onClick={() => onUpdateQty(localQty - 1)}
                            disabled={isPending || localQty <= 1}
                            className="px-2 py-1 text-sm hover:bg-accent/10 transition-colors disabled:opacity-30"
                            aria-label="Réduire la quantité"
                        >
                            −
                        </button>
                        <span className="px-3 py-1 text-sm min-w-[32px] text-center tabular-nums">
                            {localQty}
                        </span>
                        <button
                            type="button"
                            onClick={() => onUpdateQty(localQty + 1)}
                            disabled={isPending || localQty >= maxQty}
                            className="px-2 py-1 text-sm hover:bg-accent/10 transition-colors disabled:opacity-30"
                            aria-label="Augmenter la quantité"
                        >
                            +
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                            {formatPriceEur(item.variant.price_cents, {
                                showFree: false,
                            })}{" "}
                            /unité
                        </span>
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={isPending}
                            className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            aria-label="Retirer du panier"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
        </div>
    );
}