"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, X } from "lucide-react";
import { getCartGroupsAction, removeCartItemAction } from "@/app/actions/cart";
import { formatPriceEur } from "@/lib/utils/format";
import type { CartGroup } from "@/lib/dal/cart";

export function CartWidget({ itemsCount }: { itemsCount: number }) {
    const [open, setOpen] = useState(false);
    const [groups, setGroups] = useState<CartGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [isPending, startTransition] = useTransition();
    const drawerRef = useRef<HTMLDivElement>(null);

    // Fetch au premier open, puis à chaque mutation
    const fetchCart = async () => {
        setLoading(true);
        const data = await getCartGroupsAction();
        setGroups(data);
        setLoading(false);
    };

    useEffect(() => {
        if (open) fetchCart();
    }, [open]);

    // Fermeture sur Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    // Scroll lock
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    const onRemove = (cartItemId: string) => {
        const fd = new FormData();
        fd.set("cart_item_id", cartItemId);
        startTransition(async () => {
            await removeCartItemAction(fd);
            fetchCart();
        });
    };

    const totalItems = groups.reduce((acc, g) => acc + g.items_count, 0);
    const totalCents = groups.reduce((acc, g) => acc + g.subtotal_cents, 0);

    return (
        <>
            {/* Bouton header */}
            <button
                onClick={() => setOpen(true)}
                aria-label={`Panier${itemsCount > 0 ? ` (${itemsCount} article${itemsCount > 1 ? "s" : ""})` : " (vide)"}`}
                className="relative p-2 hover:bg-secondary transition-colors rounded-full"
            >
                <ShoppingBag className="w-4 h-4" strokeWidth={2} />
                {itemsCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-accent text-accent-foreground text-[10px] font-medium tabular-nums rounded-full flex items-center justify-center">
                        {itemsCount > 99 ? "99+" : itemsCount}
                    </span>
                )}
            </button>

            {/* Backdrop */}
            {open && (
                <div
                    className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Drawer */}
            <div
                ref={drawerRef}
                className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-background border-l border-border flex flex-col transition-transform duration-300 ${
                    open ? "translate-x-0" : "translate-x-full"
                }`}
            >
                {/* Header drawer */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Panier
                    </p>
                    <button
                        onClick={() => setOpen(false)}
                        className="p-1 hover:text-accent transition-colors"
                        aria-label="Fermer"
                    >
                        <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                </div>

                {/* Contenu */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                            Chargement...
                        </div>
                    ) : groups.length === 0 ? (
                        <div className="p-8 text-center space-y-3">
                            <p className="text-sm text-muted-foreground">Ton panier est vide.</p>
                            <Link
                                href="/magasins"
                                onClick={() => setOpen(false)}
                                className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                            >
                                Voir les magasins →
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {groups.map((group) => (
                                <div key={group.cart_id}>
                                    {/* Nom magasin */}
                                    <div className="px-5 py-3 bg-secondary/20">
                                        <Link
                                            href={`/magasins/${group.organization.slug}/boutique`}
                                            onClick={() => setOpen(false)}
                                            className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
                                        >
                                            {group.organization.name}
                                        </Link>
                                    </div>

                                    {/* Items */}
                                    {group.items.map((item) => {
                                        const cover = item.product.photos[0];
                                        const isUnavailable =
                                            !item.variant.is_active ||
                                            item.product.status !== "published" ||
                                            item.product.deleted_at !== null;

                                        return (
                                            <div
                                                key={item.id}
                                                className={`flex gap-3 px-5 py-4 ${isUnavailable ? "opacity-50" : ""}`}
                                            >
                                                {/* Photo */}
                                                <div className="w-14 h-14 flex-shrink-0 bg-secondary border border-border overflow-hidden">
                                                    {cover ? (
                                                        <Image
                                                            src={cover}
                                                            alt={item.product.name}
                                                            width={56}
                                                            height={56}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full" />
                                                    )}
                                                </div>

                                                {/* Infos */}
                                                <div className="flex-1 min-w-0 flex flex-col gap-1">
                                                    <p className="text-xs font-medium leading-tight line-clamp-2">
                                                        {item.product.name}
                                                    </p>
                                                    {Object.keys(item.variant.options).length > 0 && (
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {Object.entries(item.variant.options)
                                                                .map(([k, v]) => `${k}: ${v}`)
                                                                .join(" · ")}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-between mt-auto">
                                                        <span className="text-[10px] text-muted-foreground">
                                                            ×{item.quantity}
                                                        </span>
                                                        <span className="text-xs font-medium">
                                                            {formatPriceEur(
                                                                item.variant.price_cents * item.quantity,
                                                                { showFree: false }
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Supprimer */}
                                                <button
                                                    onClick={() => onRemove(item.id)}
                                                    disabled={isPending}
                                                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 self-start mt-0.5"
                                                    aria-label="Retirer"
                                                >
                                                    <X className="w-3 h-3" strokeWidth={1.75} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {groups.length > 0 && (
                    <div className="border-t border-border p-5 space-y-4">
                        <div className="flex items-baseline justify-between">
                            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                Total ({totalItems} article{totalItems > 1 ? "s" : ""})
                            </span>
                            <span className="font-display text-xl tracking-tight">
                                {formatPriceEur(totalCents, { showFree: false })}
                            </span>
                        </div>
                        <Link
                            href="/panier"
                            onClick={() => setOpen(false)}
                            className="block w-full text-center px-6 py-3 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                        >
                            Voir le panier complet →
                        </Link>
                    </div>
                )}
            </div>
        </>
    );
}