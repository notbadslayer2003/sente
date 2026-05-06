import Link from "next/link";
import type { ProductListItem } from "@/lib/dal/products";
import { ProductCard } from "@/components/sente/product-card";

type Props = {
    products: ProductListItem[];
    orgSlug: string;
    nextCursor: string | undefined;
    activeCategorySlug: string | null;
    activeSearch: string;
};

export function ShopGrid({
                             products,
                             orgSlug,
                             nextCursor,
                             activeCategorySlug,
                             activeSearch,
                         }: Props) {
    if (products.length === 0) {
        return (
            <EmptyState
                hasFilters={
                    activeCategorySlug !== null || activeSearch !== ""
                }
                orgSlug={orgSlug}
            />
        );
    }

    const buildLoadMoreUrl = (): string => {
        const params = new URLSearchParams();
        if (activeCategorySlug) params.set("category", activeCategorySlug);
        if (activeSearch) params.set("search", activeSearch);
        if (nextCursor) params.set("cursor", nextCursor);
        return `/magasins/${orgSlug}/boutique?${params.toString()}`;
    };

    return (
        <div className="space-y-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((p) => (
                    <ProductCard key={p.id} product={p} orgSlug={orgSlug} />
                ))}
            </div>

            {nextCursor && (
                <div className="flex justify-center">
                    <Link
                        href={buildLoadMoreUrl()}
                        className="px-6 py-3 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent hover:text-accent transition-colors"
                    >
                        Charger plus
                    </Link>
                </div>
            )}
        </div>
    );
}

function EmptyState({
                        hasFilters,
                        orgSlug,
                    }: {
    hasFilters: boolean;
    orgSlug: string;
}) {
    if (hasFilters) {
        return (
            <div className="border border-dashed border-border p-16 text-center">
                <p className="text-base">Aucun produit ne correspond à ces filtres.</p>
                <p className="mt-3 text-xs text-muted-foreground">
                    Essaie d'élargir ta recherche ou de retirer un filtre.
                </p>
                <Link
                    href={`/magasins/${orgSlug}/boutique`}
                    className="mt-6 inline-block px-5 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                >
                    Voir toute la boutique
                </Link>
            </div>
        );
    }

    return (
        <div className="border border-dashed border-border p-16 text-center">
            <p className="text-base">Cette boutique est encore vide.</p>
            <p className="mt-3 text-xs text-muted-foreground">
                Le magasin n'a pas encore publié de produits. Reviens bientôt.
            </p>
        </div>
    );
}