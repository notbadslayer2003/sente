"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProductCategoryTree } from "@/lib/dal/product-categories";

type Props = {
    slug: string;
    categoryTree: ProductCategoryTree[];
    activeCategorySlug: string | null;
    activeCategoryLabel: string | null;
    initialSearch: string;
};

export function ShopFilters({
                                slug,
                                categoryTree,
                                activeCategorySlug,
                                activeCategoryLabel,
                                initialSearch,
                            }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [search, setSearch] = useState(initialSearch);
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

    const buildUrl = (next: {
        category?: string | null;
        search?: string | null;
    }): string => {
        const params = new URLSearchParams();
        const newCategory =
            next.category !== undefined ? next.category : activeCategorySlug;
        const newSearch = next.search !== undefined ? next.search : search;

        if (newCategory) params.set("category", newCategory);
        if (newSearch && newSearch.trim() !== "") params.set("search", newSearch.trim());

        const qs = params.toString();
        return `/magasins/${slug}/boutique${qs ? `?${qs}` : ""}`;
    };

    const navigate = (url: string) => {
        startTransition(() => {
            router.push(url);
        });
    };

    const onSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        navigate(buildUrl({ search }));
    };

    const onClearSearch = () => {
        setSearch("");
        navigate(buildUrl({ search: "" }));
    };

    const onSelectCategory = (categorySlug: string | null) => {
        setCategoryDropdownOpen(false);
        navigate(buildUrl({ category: categorySlug }));
    };

    const hasFilters = activeCategorySlug !== null || initialSearch !== "";

    return (
        <div className="mb-8 flex flex-wrap items-center gap-3 pb-6 border-b border-border">
            {/* Dropdown catégories */}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setCategoryDropdownOpen((o) => !o)}
                    className={`px-4 py-2 text-xs uppercase tracking-wide border transition-colors ${
                        activeCategorySlug
                            ? "border-accent text-accent bg-accent/5"
                            : "border-border hover:border-accent hover:text-accent"
                    }`}
                    disabled={isPending}
                >
                    {activeCategoryLabel ?? "Toutes les catégories"}
                    <span className="ml-2 text-[10px]">
                        {categoryDropdownOpen ? "▲" : "▼"}
                    </span>
                </button>

                {categoryDropdownOpen && (
                    <>
                        {/* Backdrop pour fermer au clic extérieur */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setCategoryDropdownOpen(false)}
                        />
                        <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border shadow-lg max-h-[60vh] overflow-y-auto min-w-[260px]">
                            <button
                                type="button"
                                onClick={() => onSelectCategory(null)}
                                className={`w-full text-left px-4 py-2 text-xs uppercase tracking-wide hover:bg-accent/10 transition-colors ${
                                    !activeCategorySlug
                                        ? "text-accent"
                                        : "text-foreground"
                                }`}
                            >
                                Toutes les catégories
                            </button>

                            {categoryTree.length === 0 ? (
                                <p className="px-4 py-3 text-xs text-muted-foreground">
                                    Aucune catégorie disponible.
                                </p>
                            ) : (
                                categoryTree.map((root) => (
                                    <div
                                        key={root.id}
                                        className="border-t border-border"
                                    >
                                        <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                                            {root.name}
                                        </p>
                                        {root.children.map((child) => (
                                            <button
                                                key={child.id}
                                                type="button"
                                                onClick={() =>
                                                    onSelectCategory(child.slug)
                                                }
                                                className={`w-full text-left px-4 py-2 text-xs hover:bg-accent/10 transition-colors ${
                                                    activeCategorySlug === child.slug
                                                        ? "text-accent bg-accent/5"
                                                        : "text-foreground"
                                                }`}
                                            >
                                                {child.name}
                                            </button>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Search */}
            <form
                onSubmit={onSearchSubmit}
                className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md"
            >
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher dans la boutique..."
                    className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    disabled={isPending}
                />
                {search !== initialSearch && search.trim() !== "" && (
                    <button
                        type="submit"
                        disabled={isPending}
                        className="px-3 py-2 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-50"
                    >
                        OK
                    </button>
                )}
                {initialSearch !== "" && (
                    <button
                        type="button"
                        onClick={onClearSearch}
                        disabled={isPending}
                        className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                        ×
                    </button>
                )}
            </form>

            {/* Reset all */}
            {hasFilters && (
                <button
                    type="button"
                    onClick={() => {
                        setSearch("");
                        navigate(`/magasins/${slug}/boutique`);
                    }}
                    disabled={isPending}
                    className="ml-auto text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                    Réinitialiser
                </button>
            )}
        </div>
    );
}