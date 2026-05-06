"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    refundOrderItemAction,
    refundOrderShippingAction,
    refundFullOrderAction,
} from "@/app/actions/order-refunds";
import { formatPriceEur } from "@/lib/utils/format";
import type { OrderDetail, OrderItemDetail } from "@/lib/dal/orders";

type Props = {
    order: OrderDetail;
};

type Mode = "closed" | "by_item" | "shipping" | "full";

export function OrderRefundPanel({ order }: Props) {
    const [mode, setMode] = useState<Mode>("closed");

    // Calcul des "refundabilités"
    const hasItemsRefundable = order.items.some(
        (it) => it.quantity - it.refunded_quantity > 0
    );
    const hasShippingRefundable =
        order.shipping_cents > 0 &&
        // On ne sait pas côté client si le shipping est déjà refundé. La RPC bloquera
        // si c'est le cas. Pour l'instant on affiche toujours si shipping_cents > 0.
        true;
    const isRefundableStatus = [
        "paid",
        "preparing",
        "ready_for_pickup",
        "shipped",
        "delivered",
    ].includes(order.status);

    // Pas de refund possible
    if (!isRefundableStatus) {
        return null;
    }

    if (!hasItemsRefundable && !hasShippingRefundable) {
        return (
            <div className="border border-border p-5">
                <p className="text-sm text-muted-foreground">
                    Tous les remboursements ont été effectués.
                </p>
            </div>
        );
    }

    return (
        <div className="border border-border p-5 space-y-4">
            {mode === "closed" && (
                <>
                    <p className="text-sm">
                        Rembourse tout ou partie de cette commande. Le montant sera
                        immédiatement remboursé sur la carte du client.
                    </p>
                    <div className="space-y-2">
                        {hasItemsRefundable && (
                            <button
                                type="button"
                                onClick={() => setMode("by_item")}
                                className="w-full text-left px-4 py-3 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                            >
                                Rembourser des articles
                                <span className="block normal-case tracking-normal text-[11px] text-muted-foreground mt-0.5">
                                    Sélectionne quelles unités rembourser.
                                </span>
                            </button>
                        )}
                        {hasShippingRefundable && (
                            <button
                                type="button"
                                onClick={() => setMode("shipping")}
                                className="w-full text-left px-4 py-3 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                            >
                                Rembourser les frais de port
                                <span className="block normal-case tracking-normal text-[11px] text-muted-foreground mt-0.5">
                                    {formatPriceEur(order.shipping_cents, {
                                        showFree: false,
                                    })}{" "}
                                    de frais de livraison.
                                </span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setMode("full")}
                            className="w-full text-left px-4 py-3 text-xs uppercase tracking-wide border border-destructive/40 text-destructive hover:bg-destructive/5 transition-colors"
                        >
                            Tout rembourser
                            <span className="block normal-case tracking-normal text-[11px] text-muted-foreground mt-0.5">
                                Articles restants + port (optionnel).
                            </span>
                        </button>
                    </div>
                </>
            )}

            {mode === "by_item" && (
                <RefundByItemForm
                    order={order}
                    onClose={() => setMode("closed")}
                />
            )}

            {mode === "shipping" && (
                <RefundShippingForm
                    order={order}
                    onClose={() => setMode("closed")}
                />
            )}

            {mode === "full" && (
                <RefundFullForm order={order} onClose={() => setMode("closed")} />
            )}
        </div>
    );
}

// =============================================================================
// Form refund par item
// =============================================================================

function RefundByItemForm({
                              order,
                              onClose,
                          }: {
    order: OrderDetail;
    onClose: () => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [refundQty, setRefundQty] = useState(1);
    const [reason, setReason] = useState("");

    const refundableItems = order.items.filter(
        (it) => it.quantity - it.refunded_quantity > 0
    );
    const selectedItem = refundableItems.find((it) => it.id === selectedItemId);
    const maxQty = selectedItem
        ? selectedItem.quantity - selectedItem.refunded_quantity
        : 0;
    const refundAmount = selectedItem
        ? selectedItem.unit_price_cents * refundQty
        : 0;

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedItemId || !selectedItem) {
            setError("Sélectionne un article");
            return;
        }

        const fd = new FormData();
        fd.set("order_item_id", selectedItemId);
        fd.set("refund_quantity", String(refundQty));
        fd.set("reason", reason.trim());

        startTransition(async () => {
            setError(null);
            const r = await refundOrderItemAction(fd);
            if (r.ok) {
                router.refresh();
                onClose();
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Rembourser un article
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    ←
                </button>
            </div>

            {/* Sélection item */}
            <div className="space-y-2">
                {refundableItems.map((it) => (
                    <ItemRadio
                        key={it.id}
                        item={it}
                        selected={selectedItemId === it.id}
                        onSelect={() => {
                            setSelectedItemId(it.id);
                            setRefundQty(1);
                        }}
                    />
                ))}
            </div>

            {/* Quantité */}
            {selectedItem && maxQty > 1 && (
                <div>
                    <label className="block">
                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Quantité à rembourser (max {maxQty})
                        </span>
                        <div className="mt-2 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setRefundQty((q) => Math.max(1, q - 1))}
                                disabled={isPending || refundQty <= 1}
                                className="w-8 h-8 flex items-center justify-center border border-border hover:bg-accent/10 transition-colors disabled:opacity-30"
                            >
                                −
                            </button>
                            <span className="px-4 py-1 text-sm tabular-nums min-w-[40px] text-center">
                                {refundQty}
                            </span>
                            <button
                                type="button"
                                onClick={() => setRefundQty((q) => Math.min(maxQty, q + 1))}
                                disabled={isPending || refundQty >= maxQty}
                                className="w-8 h-8 flex items-center justify-center border border-border hover:bg-accent/10 transition-colors disabled:opacity-30"
                            >
                                +
                            </button>
                        </div>
                    </label>
                </div>
            )}

            {/* Montant calculé */}
            {selectedItem && (
                <div className="border border-accent/30 bg-accent/5 p-3 flex items-baseline justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Montant remboursé
                    </span>
                    <span className="font-display text-xl tracking-tight">
                        {formatPriceEur(refundAmount, { showFree: false })}
                    </span>
                </div>
            )}

            {/* Raison */}
            <div>
                <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Raison (visible par le client)
                    </span>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        minLength={10}
                        maxLength={1000}
                        required
                        placeholder="ex: Produit en rupture de stock découvert lors de la préparation..."
                        disabled={isPending}
                        className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
                    />
                </label>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={
                        isPending || !selectedItemId || reason.trim().length < 10
                    }
                    className="flex-1 px-4 py-2 text-xs uppercase tracking-wide bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                    {isPending ? "..." : "Confirmer le remboursement"}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}

function ItemRadio({
                       item,
                       selected,
                       onSelect,
                   }: {
    item: OrderItemDetail;
    selected: boolean;
    onSelect: () => void;
}) {
    const remainingQty = item.quantity - item.refunded_quantity;
    return (
        <label
            className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                selected
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/50"
            }`}
        >
            <input
                type="radio"
                name="refund_item"
                checked={selected}
                onChange={onSelect}
                className="mt-1 accent-accent"
            />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.product_name}</p>
                {item.variant_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {item.variant_name}
                    </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                    {remainingQty}/{item.quantity} unité
                    {remainingQty > 1 ? "s" : ""} remboursable
                    {remainingQty > 1 ? "s" : ""} ·{" "}
                    {formatPriceEur(item.unit_price_cents, { showFree: false })}{" "}
                    /unité
                </p>
            </div>
        </label>
    );
}

// =============================================================================
// Form refund shipping
// =============================================================================

function RefundShippingForm({
                                order,
                                onClose,
                            }: {
    order: OrderDetail;
    onClose: () => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [reason, setReason] = useState("");

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("order_id", order.id);
        fd.set("reason", reason.trim());

        startTransition(async () => {
            setError(null);
            const r = await refundOrderShippingAction(fd);
            if (r.ok) {
                router.refresh();
                onClose();
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Rembourser le port
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    ←
                </button>
            </div>

            <div className="border border-accent/30 bg-accent/5 p-3 flex items-baseline justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Montant
                </span>
                <span className="font-display text-xl tracking-tight">
                    {formatPriceEur(order.shipping_cents, { showFree: false })}
                </span>
            </div>

            <div>
                <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Raison
                    </span>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        minLength={10}
                        maxLength={1000}
                        required
                        placeholder="ex: Geste commercial suite à un retard de livraison..."
                        disabled={isPending}
                        className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
                    />
                </label>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending || reason.trim().length < 10}
                    className="flex-1 px-4 py-2 text-xs uppercase tracking-wide bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                    {isPending ? "..." : "Confirmer"}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}

// =============================================================================
// Form refund full order
// =============================================================================

function RefundFullForm({
                            order,
                            onClose,
                        }: {
    order: OrderDetail;
    onClose: () => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [includeShipping, setIncludeShipping] = useState(true);
    const [reason, setReason] = useState("");

    // Calcul total remboursable
    const itemsRefundable = order.items.reduce(
        (acc, it) =>
            acc + (it.quantity - it.refunded_quantity) * it.unit_price_cents,
        0
    );
    const totalRefund =
        itemsRefundable + (includeShipping ? order.shipping_cents : 0);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("order_id", order.id);
        fd.set("include_shipping", String(includeShipping));
        fd.set("reason", reason.trim());

        startTransition(async () => {
            setError(null);
            const r = await refundFullOrderAction(fd);
            if (r.ok) {
                router.refresh();
                onClose();
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-destructive">
                    Tout rembourser
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    ←
                </button>
            </div>

            <div className="space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                    <span className="text-muted-foreground">
                        Articles restants
                    </span>
                    <span className="tabular-nums">
                        {formatPriceEur(itemsRefundable, { showFree: false })}
                    </span>
                </div>
                {order.shipping_cents > 0 && (
                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                        <span className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={includeShipping}
                                onChange={(e) => setIncludeShipping(e.target.checked)}
                                className="accent-accent"
                            />
                            <span className="text-muted-foreground">
                                Inclure les frais de port
                            </span>
                        </span>
                        <span className="tabular-nums">
                            {includeShipping ? "+" : ""}
                            {formatPriceEur(order.shipping_cents, {
                                showFree: false,
                            })}
                        </span>
                    </label>
                )}
                <div className="pt-3 border-t border-border flex items-baseline justify-between gap-4">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Total remboursé
                    </span>
                    <span className="font-display text-2xl tracking-tight">
                        {formatPriceEur(totalRefund, { showFree: false })}
                    </span>
                </div>
            </div>

            <div>
                <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Raison
                    </span>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        minLength={10}
                        maxLength={1000}
                        required
                        placeholder="ex: Annulation de la commande à la demande du client..."
                        disabled={isPending}
                        className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
                    />
                </label>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending || reason.trim().length < 10}
                    className="flex-1 px-4 py-2 text-xs uppercase tracking-wide bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                    {isPending ? "..." : "Tout rembourser"}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}