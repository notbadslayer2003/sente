"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
    type OrderListItem,
    type OrderStatus,
    type OrderStatusFilter,
    type DeliveryMethod,
} from "@/lib/dal/orders";
import { formatPriceEur } from "@/lib/utils/format";

type Props = {
    slug: string;
    orders: OrderListItem[];
    counts: Record<OrderStatusFilter, number>;
    currentFilter: OrderStatusFilter;
    currentDelivery: DeliveryMethod | "all";
    currentSearch: string;
};

const FILTER_TABS: Array<{
    value: OrderStatusFilter;
    label: string;
}> = [
    { value: "all", label: "Toutes" },
    { value: "to_prepare", label: "À préparer" },
    { value: "in_progress", label: "En cours" },
    { value: "completed", label: "Terminées" },
    { value: "cancelled_or_refunded", label: "Annulées" },
];

const DELIVERY_OPTIONS: Array<{
    value: DeliveryMethod | "all";
    label: string;
}> = [
    { value: "all", label: "Tous modes" },
    { value: "click_collect", label: "Retrait" },
    { value: "shipping_standard", label: "Livraison standard" },
    { value: "shipping_local", label: "Livraison locale" },
];

export function OrdersList({
                               slug,
                               orders,
                               counts,
                               currentFilter,
                               currentDelivery,
                               currentSearch,
                           }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [searchInput, setSearchInput] = useState(currentSearch);

    const buildUrl = (next: {
        filter?: string;
        delivery?: string;
        search?: string;
    }): string => {
        const params = new URLSearchParams(searchParams.toString());

        if (next.filter !== undefined) {
            if (next.filter === "all") params.delete("filter");
            else params.set("filter", next.filter);
        }
        if (next.delivery !== undefined) {
            if (next.delivery === "all") params.delete("delivery");
            else params.set("delivery", next.delivery);
        }
        if (next.search !== undefined) {
            if (next.search === "") params.delete("search");
            else params.set("search", next.search);
        }
        const qs = params.toString();
        return `/dashboard/${slug}/commandes${qs ? `?${qs}` : ""}`;
    };

    const navigate = (url: string) => {
        startTransition(() => router.push(url));
    };

    const onSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        navigate(buildUrl({ search: searchInput.trim() }));
    };

    return (
        <div className="space-y-6">
            {/* Onglets filtre statut */}
            <div className="flex flex-wrap gap-1 border-b border-border">
                {FILTER_TABS.map((tab) => {
                    const active = currentFilter === tab.value;
                    const count = counts[tab.value] ?? 0;
                    return (
                        <button
                            key={tab.value}
                            onClick={() => navigate(buildUrl({ filter: tab.value }))}
                            disabled={isPending}
                            className={`px-4 py-2 text-xs uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                                active
                                    ? "border-accent text-accent"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {tab.label}
                            <span className="ml-2 text-[10px] text-muted-foreground tabular-nums">
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Filtres delivery + search */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={currentDelivery}
                    onChange={(e) => navigate(buildUrl({ delivery: e.target.value }))}
                    disabled={isPending}
                    className="bg-background border border-border px-3 py-2 text-xs uppercase tracking-wide cursor-pointer focus:border-accent focus:outline-none"
                >
                    {DELIVERY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>

                <form
                    onSubmit={onSearchSubmit}
                    className="flex gap-2 flex-1 min-w-[200px] max-w-md"
                >
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Numéro, nom client, email..."
                        className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                        disabled={isPending}
                    />
                    {searchInput !== currentSearch && searchInput.trim() !== "" && (
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-3 py-2 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-50"
                        >
                            OK
                        </button>
                    )}
                    {currentSearch !== "" && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput("");
                                navigate(buildUrl({ search: "" }));
                            }}
                            disabled={isPending}
                            className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                        >
                            ×
                        </button>
                    )}
                </form>
            </div>

            {/* Liste / Empty state */}
            {orders.length === 0 ? (
                <EmptyState
                    hasFilters={
                        currentFilter !== "all" ||
                        currentDelivery !== "all" ||
                        currentSearch !== ""
                    }
                    slug={slug}
                />
            ) : (
                <div className="border border-border">
                    <table className="w-full">
                        <thead>
                        <tr className="border-b border-border bg-secondary/20">
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                Numéro
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal hidden md:table-cell">
                                Client
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal hidden lg:table-cell">
                                Articles
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal hidden lg:table-cell">
                                Mode
                            </th>
                            <th className="text-right p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                Total
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                Statut
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal hidden md:table-cell">
                                Date
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {orders.map((o) => (
                            <OrderRow key={o.id} order={o} slug={slug} />
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function OrderRow({
                      order,
                      slug,
                  }: Readonly<{
    order: OrderListItem;
    slug: string;
}>) {
    const router = useRouter();
    const orderShort = order.id.slice(0, 8).toUpperCase();
    const date = order.paid_at ?? order.created_at;
    const detailUrl = `/dashboard/${slug}/commandes/${order.id}`;

    return (
        <tr
            onClick={() => router.push(detailUrl)}
            className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors cursor-pointer"
        >
            <td className="p-3">
                <Link
                    href={detailUrl}
                    className="text-xs font-mono hover:text-accent transition-colors"
                >
                    #{orderShort}
                </Link>
            </td>
            <td className="p-3 hidden md:table-cell">
                <div className="text-sm truncate max-w-[200px]">
                    {order.customer_name ?? (
                        <span className="text-muted-foreground italic">—</span>
                    )}
                </div>
                {order.customer_email && (
                    <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {order.customer_email}
                    </div>
                )}
            </td>
            <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                {order.items_count}
            </td>
            <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                <DeliveryLabel method={order.delivery_method} />
            </td>
            <td className="p-3 text-right text-sm font-medium tabular-nums">
                {formatPriceEur(order.total_cents, { showFree: false })}
            </td>
            <td className="p-3">
                <OrderStatusBadge status={order.status} />
            </td>
            <td className="p-3 text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">
                {formatRelativeDate(date)}
            </td>
        </tr>
    );
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
    const map: Record<OrderStatus, { label: string; className: string }> = {
        pending_payment: {
            label: "Paiement en cours",
            className: "bg-muted text-muted-foreground",
        },
        paid: {
            label: "À préparer",
            className: "bg-accent/15 text-accent",
        },
        preparing: {
            label: "En préparation",
            className: "bg-accent/15 text-accent",
        },
        ready_for_pickup: {
            label: "Prête à retirer",
            className: "bg-primary/15 text-primary",
        },
        shipped: {
            label: "Expédiée",
            className: "bg-primary/15 text-primary",
        },
        delivered: {
            label: "Livrée",
            className: "bg-secondary text-foreground",
        },
        cancelled: {
            label: "Annulée",
            className: "bg-destructive/15 text-destructive",
        },
        refunded: {
            label: "Remboursée",
            className: "bg-destructive/15 text-destructive",
        },
        disputed: {
            label: "Litige",
            className: "bg-destructive/15 text-destructive",
        },
    };
    const variant = map[status];
    return (
        <span
            className={`px-2 py-0.5 text-[10px] uppercase tracking-wide whitespace-nowrap ${variant.className}`}
        >
            {variant.label}
        </span>
    );
}

function DeliveryLabel({
                           method,
                       }: {
    method: DeliveryMethod | null;
}) {
    if (!method) return <span className="italic">—</span>;
    const labels: Record<DeliveryMethod, string> = {
        click_collect: "Retrait",
        shipping_standard: "Standard",
        shipping_local: "Locale",
    };
    return <>{labels[method]}</>;
}

function formatRelativeDate(iso: string): string {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffH = diffMs / (1000 * 60 * 60);
    const diffD = diffH / 24;

    if (diffH < 1) return "à l'instant";
    if (diffH < 24) return `il y a ${Math.floor(diffH)}h`;
    if (diffD < 7) return `il y a ${Math.floor(diffD)}j`;

    return date.toLocaleDateString("fr-BE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function EmptyState({
                        hasFilters,
                        slug,
                    }: {
    hasFilters: boolean;
    slug: string;
}) {
    if (hasFilters) {
        return (
            <div className="border border-dashed border-border p-12 text-center">
                <p className="text-sm">Aucune commande ne correspond à ces filtres.</p>
                <Link
                    href={`/dashboard/${slug}/commandes`}
                    className="mt-6 inline-block px-5 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                >
                    Voir toutes les commandes
                </Link>
            </div>
        );
    }

    return (
        <div className="border border-dashed border-border p-12 text-center">
            <p className="text-base">Tu n'as pas encore reçu de commande.</p>
            <p className="mt-2 text-xs text-muted-foreground">
                Elles apparaîtront ici dès qu'un client achètera dans ta boutique.
            </p>
        </div>
    );
}