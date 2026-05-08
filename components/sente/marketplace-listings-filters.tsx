"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// =============================================================================
// MarketplaceFilters — sidebar filtres marketplace browse
// =============================================================================
// Submit → router.push avec les nouveaux searchParams.
// =============================================================================

type Category = {
    id: string;
    slug: string;
    name_fr: string;
    parent_id: string | null;
};

const INPUT_CLS =
    "mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent";
const SELECT_CLS = `${INPUT_CLS} cursor-pointer`;

export function MarketplaceFilters({
                                       categories,
                                       currentFilters,
                                   }: {
    categories: Category[];
    currentFilters: {
        categorySlug?: string;
        condition?: string;
        country?: string;
        city?: string;
        search?: string;
        minPriceCents?: number;
        maxPriceCents?: number;
        sort?: string;
    };
}) {
    const router = useRouter();
    const [search, setSearch] = useState(currentFilters.search ?? "");
    const [categorySlug, setCategorySlug] = useState(
        currentFilters.categorySlug ?? ""
    );
    const [condition, setCondition] = useState(currentFilters.condition ?? "");
    const [country, setCountry] = useState(currentFilters.country ?? "");
    const [city, setCity] = useState(currentFilters.city ?? "");
    const [minPrice, setMinPrice] = useState(
        currentFilters.minPriceCents !== undefined
            ? (currentFilters.minPriceCents / 100).toString()
            : ""
    );
    const [maxPrice, setMaxPrice] = useState(
        currentFilters.maxPriceCents !== undefined
            ? (currentFilters.maxPriceCents / 100).toString()
            : ""
    );
    const [sort, setSort] = useState(currentFilters.sort ?? "recent");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (categorySlug) params.set("category", categorySlug);
        if (condition) params.set("condition", condition);
        if (country) params.set("country", country);
        if (city.trim()) params.set("city", city.trim());
        if (minPrice) params.set("min_price", minPrice);
        if (maxPrice) params.set("max_price", maxPrice);
        if (sort && sort !== "recent") params.set("sort", sort);

        const url = params.toString() ? `/marketplace?${params}` : "/marketplace";
        router.push(url);
    }

    function handleReset() {
        setSearch("");
        setCategorySlug("");
        setCondition("");
        setCountry("");
        setCity("");
        setMinPrice("");
        setMaxPrice("");
        setSort("recent");
        router.push("/marketplace");
    }

    // Catégories N1 uniquement (parent_id null) — simplification UI
    const topLevelCategories = categories
        .filter((c) => c.parent_id === null)
        .sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr"));

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-6 lg:sticky lg:top-24"
        >
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Filtres
            </p>

            <Field label="Rechercher">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Canne, moulinet, marque…"
                    className={INPUT_CLS}
                />
            </Field>

            <Field label="Catégorie">
                <select
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    className={SELECT_CLS}
                >
                    <option value="">Toutes</option>
                    {topLevelCategories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                            {c.name_fr}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="État">
                <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className={SELECT_CLS}
                >
                    <option value="">Tous</option>
                    <option value="new_with_tag">Neuf avec étiquette</option>
                    <option value="new">Neuf</option>
                    <option value="very_good">Très bon état</option>
                    <option value="good">Bon état</option>
                    <option value="acceptable">Correct</option>
                </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Field label="Prix min (€)">
                    <input
                        type="number"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        min={0}
                        step="0.01"
                        className={INPUT_CLS}
                    />
                </Field>
                <Field label="Prix max (€)">
                    <input
                        type="number"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        min={0}
                        step="0.01"
                        className={INPUT_CLS}
                    />
                </Field>
            </div>

            <Field label="Pays">
                <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={SELECT_CLS}
                >
                    <option value="">Tous</option>
                    <option value="BE">Belgique</option>
                    <option value="FR">France</option>
                </select>
            </Field>

            <Field label="Ville">
                <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mons, Lille…"
                    className={INPUT_CLS}
                />
            </Field>

            <Field label="Tri">
                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className={SELECT_CLS}
                >
                    <option value="recent">Plus récents</option>
                    <option value="price_asc">Prix croissant</option>
                    <option value="price_desc">Prix décroissant</option>
                </select>
            </Field>

            <div className="flex items-center gap-4 pt-2">
                <button
                    type="submit"
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-4 py-2.5 text-xs uppercase tracking-wide font-medium"
                >
                    Appliquer
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                >
                    Reset
                </button>
            </div>
        </form>
    );
}

function Field({
                   label,
                   children,
               }: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
            </span>
            {children}
        </label>
    );
}