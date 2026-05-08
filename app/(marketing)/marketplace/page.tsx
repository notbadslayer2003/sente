import Link from "next/link";
import { getMarketplacePublicListings } from "@/lib/dal/marketplace-listings";
import { getMarketplaceCategories } from "@/lib/dal/marketplace-categories";
import { getMarketplacePublicUrl } from "@/lib/storage/marketplace-r2";
import { buildListingUrl } from "@/lib/marketplace/listing-url";
import { MarketplaceFilters } from "@/components/sente/marketplace-listings-filters";

// =============================================================================
// Page : /marketplace
// =============================================================================
// Browse public des annonces actives. Filtres en sidebar gauche, grille à
// droite. Filtres via URL (?category=...&q=...&page=2).
// =============================================================================

const CONDITION_LABELS: Record<string, string> = {
    new_with_tag: "Neuf avec étiquette",
    new: "Neuf",
    very_good: "Très bon",
    good: "Bon état",
    acceptable: "Correct",
};

function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString("fr-BE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
    });
}

function parsePositiveInt(v: string | undefined): number | undefined {
    if (typeof v !== "string") return undefined;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parsePriceCents(v: string | undefined): number | undefined {
    if (typeof v !== "string") return undefined;
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

export default async function MarketplacePage({
                                                  searchParams,
                                              }: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const sp = await searchParams;

    const filters = {
        categorySlug: typeof sp.category === "string" ? sp.category : undefined,
        condition: typeof sp.condition === "string" ? sp.condition : undefined,
        country:
            sp.country === "BE" || sp.country === "FR"
                ? (sp.country as "BE" | "FR")
                : undefined,
        city: typeof sp.city === "string" ? sp.city : undefined,
        search: typeof sp.q === "string" ? sp.q : undefined,
        minPriceCents: parsePriceCents(
            typeof sp.min_price === "string" ? sp.min_price : undefined
        ),
        maxPriceCents: parsePriceCents(
            typeof sp.max_price === "string" ? sp.max_price : undefined
        ),
        sort:
            sp.sort === "price_asc" || sp.sort === "price_desc"
                ? (sp.sort as "price_asc" | "price_desc")
                : ("recent" as const),
        page:
            parsePositiveInt(typeof sp.page === "string" ? sp.page : undefined) ??
            1,
    };

    const [listingsResult, categories] = await Promise.all([
        getMarketplacePublicListings(filters),
        getMarketplaceCategories(),
    ]);

    const { items, total, page, pageSize } = listingsResult;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    function buildPageUrl(targetPage: number): string {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(sp)) {
            if (typeof v === "string" && k !== "page") params.set(k, v);
        }
        if (targetPage > 1) params.set("page", String(targetPage));
        return params.toString() ? `/marketplace?${params}` : "/marketplace";
    }

    return (
        <div className="space-y-12">
            {/* Header */}
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Communauté pêche
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Marketplace
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Matériel d&apos;occasion entre pêcheurs.{" "}
                    <span className="text-foreground">
                        {total} {total === 1 ? "annonce" : "annonces"}
                    </span>{" "}
                    en ce moment.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[260px_1fr]">
                <aside>
                    <MarketplaceFilters
                        categories={categories}
                        currentFilters={filters}
                    />
                </aside>

                <main>
                    {items.length === 0 ? (
                        <div className="border border-dashed border-border p-12 text-center">
                            <p className="text-sm text-muted-foreground">
                                Aucune annonce ne correspond à ces filtres.
                            </p>
                            <Link
                                href="/marketplace"
                                className="mt-4 inline-block text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                            >
                                Voir toutes les annonces →
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                                {items.map((listing) => {
                                    const firstPhoto = listing.photos[0];
                                    const photoUrl = firstPhoto
                                        ? getMarketplacePublicUrl(firstPhoto.storage_path)
                                        : null;

                                    return (
                                        <Link
                                            key={listing.id}
                                            href={buildListingUrl(listing)}
                                            className="group"
                                        >
                                            <div className="aspect-square overflow-hidden border border-border bg-secondary/40">
                                                {photoUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={photoUrl}
                                                        alt={listing.title}
                                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center">
                                                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                                            Sans photo
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-3 space-y-1.5">
                                                <p className="truncate font-display text-base tracking-tight leading-tight group-hover:text-accent transition-colors">
                                                    {listing.title}
                                                </p>
                                                <p className="font-display text-xl tracking-tight">
                                                    {formatPrice(listing.price_cents)}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {CONDITION_LABELS[listing.condition] ??
                                                        listing.condition}
                                                    {listing.brand && (
                                                        <>
                                                            <span className="mx-1.5 text-border">·</span>
                                                            {listing.brand.name}
                                                        </>
                                                    )}
                                                </p>
                                                <p className="truncate text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                                    {listing.city}, {listing.country}
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            {totalPages > 1 && (
                                <nav className="mt-12 flex items-center justify-center gap-6">
                                    {page > 1 ? (
                                        <Link
                                            href={buildPageUrl(page - 1)}
                                            className="text-xs uppercase tracking-wide hover:text-accent transition-colors"
                                        >
                                            ← Précédent
                                        </Link>
                                    ) : (
                                        <span className="text-xs uppercase tracking-wide text-muted-foreground/50">
                                            ← Précédent
                                        </span>
                                    )}
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                        Page {page} / {totalPages}
                                    </span>
                                    {page < totalPages ? (
                                        <Link
                                            href={buildPageUrl(page + 1)}
                                            className="text-xs uppercase tracking-wide hover:text-accent transition-colors"
                                        >
                                            Suivant →
                                        </Link>
                                    ) : (
                                        <span className="text-xs uppercase tracking-wide text-muted-foreground/50">
                                            Suivant →
                                        </span>
                                    )}
                                </nav>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}