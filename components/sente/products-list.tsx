"use client";

import Link from "next/link";
import Image from "next/image";
import {useRouter, useSearchParams} from "next/navigation";
import {useState, useTransition} from "react";
import type {
    ProductListItem,
    ProductStatus,
} from "@/lib/dal/products";
import {
    formatPriceRangeEur,
    formatStockLabel,
} from "@/lib/utils/format";

type StockFilter = "all" | "out" | "low" | "alerts";

type Props = {
    slug: string;
    products: ProductListItem[];
    counts: Record<ProductStatus, number>;
    currentStatus: ProductStatus | "all";
    currentSearch: string;
    currentStock: StockFilter;
};

const STATUS_TABS: Array<{
    value: ProductStatus | "all";
    label: string;
    countKey: ProductStatus | "total";
}> = [
    {value: "all", label: "Tout", countKey: "total"},
    {value: "draft", label: "Brouillons", countKey: "draft"},
    {value: "published", label: "Publiés", countKey: "published"},
    {value: "archived", label: "Archivés", countKey: "archived"},
];

export function ProductsList({
                                 slug,
                                 products,
                                 counts,
                                 currentStatus,
                                 currentSearch,
                                 currentStock,
                             }: Readonly<Props>) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [searchInput, setSearchInput] = useState(currentSearch);

    const total = counts.draft + counts.published + counts.archived;
    const countByKey: Record<string, number> = {
        total,
        ...counts,
    };

    const updateUrl = (next: {
        status?: string;
        search?: string;
        stock?: string;
    }) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next.status !== undefined) {
            if (next.status === "all") params.delete("status");
            else params.set("status", next.status);
        }
        if (next.search !== undefined) {
            if (next.search === "") params.delete("search");
            else params.set("search", next.search);
        }
        if (next.stock !== undefined) {
            if (next.stock === "all") params.delete("stock");
            else params.set("stock", next.stock);
        }
        const qs = params.toString();
        startTransition(() => {
            router.push(`/dashboard/${slug}/produits${qs ? `?${qs}` : ""}`);
        });
    };

    const onSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateUrl({search: searchInput.trim()});
    };

    // Filtre stock côté client (les produits sont déjà tous là, on filtre en mémoire)
    const filteredProducts = products.filter((p) => {
        if (currentStock === "all") return true;
        if (p.has_only_unlimited_stock) return false;

        if (currentStock === "out") return p.has_out_of_stock_variant;
        if (currentStock === "low")
            return p.has_low_stock_variant && !p.has_out_of_stock_variant;
        if (currentStock === "alerts")
            return p.has_out_of_stock_variant || p.has_low_stock_variant;

        return true;
    });

    return (
        <div className="space-y-6">
            {/* Tabs filtres statut */}
            <div className="flex flex-wrap gap-1 border-b border-border">
                {STATUS_TABS.map((tab) => {
                    const active = currentStatus === tab.value;
                    const count = countByKey[tab.countKey] ?? 0;
                    return (
                        <button
                            key={tab.value}
                            onClick={() => updateUrl({status: tab.value})}
                            className={`px-4 py-2 text-xs uppercase tracking-wide transition-colors border-b-2 -mb-px ${
                                active
                                    ? "border-accent text-accent"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                            disabled={isPending}
                        >
                            {tab.label}
                            <span className="ml-2 text-[10px] text-muted-foreground">
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Search bar */}
            {/* Stock filter + Search bar */}
            <div className="flex flex-wrap items-center gap-3">
                <select
                    value={currentStock}
                    onChange={(e) => updateUrl({stock: e.target.value})}
                    disabled={isPending}
                    className="bg-background border border-border px-3 py-2 text-xs uppercase tracking-wide cursor-pointer focus:border-accent focus:outline-none"
                >
                    <option value="all">Tous stocks</option>
                    <option value="alerts">Alertes (rupture + bas)</option>
                    <option value="out">En rupture</option>
                    <option value="low">Stock bas (≤5)</option>
                </select>

                <form
                    onSubmit={onSearchSubmit}
                    className="flex gap-2 flex-1 min-w-[200px] max-w-md"
                >
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Rechercher par nom..."
                        className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={isPending}
                        className="px-4 py-2 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-50"
                    >
                        Rechercher
                    </button>
                    {currentSearch && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchInput("");
                                updateUrl({search: ""});
                            }}
                            className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors"
                        >
                            Effacer
                        </button>
                    )}
                </form>
            </div>

            {/* Liste produits */}
            {filteredProducts.length === 0 ? (
                <EmptyState
                    hasFilters={
                        currentStatus !== "all" ||
                        currentSearch !== "" ||
                        currentStock !== "all"
                    }
                    slug={slug}
                />
            ) : (
                <div className="border border-border">
                    <table className="w-full">
                        <thead>
                        <tr className="border-b border-border bg-secondary/20">
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                Produit
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal hidden md:table-cell">
                                Catégorie
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal hidden lg:table-cell">
                                Prix
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal hidden lg:table-cell">
                                Stock
                            </th>
                            <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                Statut
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredProducts.map((p) => (
                            <ProductRow
                                key={p.id}
                                product={p}
                                slug={slug}
                            />
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function ProductRow({
                        product,
                        slug,
                    }: {
    product: ProductListItem;
    slug: string;
}) {
    const cover = product.photos[0];
    return (
        <tr className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
            <td className="p-3">
                <Link
                    href={`/dashboard/${slug}/produits/${product.id}`}
                    className="flex items-center gap-3 group"
                >
                    <div
                        className="w-12 h-12 bg-secondary/40 border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                        {cover ? (
                            <Image
                                src={cover}
                                alt={product.name}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                                Pas
                                <br/>
                                d'image
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-sm group-hover:text-accent transition-colors truncate">
                            {product.name}
                        </p>
                        {product.brand && (
                            <p className="text-xs text-muted-foreground">{product.brand}</p>
                        )}
                    </div>
                </Link>
            </td>
            <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                {product.category.parent_name && (
                    <span>{product.category.parent_name} ›</span>
                )}{" "}
                {product.category.name}
            </td>
            <td className="p-3 text-sm hidden lg:table-cell">
                {product.variants_count === 0 ? (
                    <span className="text-muted-foreground italic">Aucune variante</span>
                ) : (
                    formatPriceRangeEur(
                        product.min_price_cents,
                        product.max_price_cents
                    )
                )}
            </td>
            <td className="p-3 text-xs hidden lg:table-cell">
                <StockIndicator product={product}/>
            </td>
            <td className="p-3">
                <ProductStatusBadge status={product.status}/>
            </td>
        </tr>
    );
}

function ProductStatusBadge({status}: { status: ProductStatus }) {
    const map: Record<ProductStatus, { label: string; className: string }> = {
        draft: {
            label: "Brouillon",
            className: "bg-muted text-muted-foreground",
        },
        published: {
            label: "Publié",
            className: "bg-primary/15 text-primary",
        },
        archived: {
            label: "Archivé",
            className: "bg-secondary text-muted-foreground",
        },
    };
    const variant = map[status];
    return (
        <span
            className={`px-2 py-0.5 text-[10px] uppercase tracking-wide ${variant.className}`}
        >
            {variant.label}
        </span>
    );
}

function StockIndicator({ product }: { product: ProductListItem }) {
    if (product.has_out_of_stock_variant) {
        return (
            <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                <span className="text-destructive">Rupture</span>
            </span>
        );
    }
    if (product.has_low_stock_variant) {
        return (
            <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-accent">Stock bas</span>
            </span>
        );
    }
    if (product.has_stock) {
        return (
            <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">Disponible</span>
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted" />
            <span className="text-muted-foreground">—</span>
        </span>
    );
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
                <p className="text-sm text-muted-foreground">
                    Aucun produit ne correspond à ces filtres.
                </p>
            </div>
        );
    }
    return (
        <div className="border border-dashed border-border p-12 text-center">
            <p className="text-sm text-foreground">
                Tu n'as pas encore de produit.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
                Clique sur "Nouveau produit" en haut à droite pour créer ton premier
                article.
            </p>
        </div>
    );
}