import Link from "next/link";
import { getDashboardContext } from "@/lib/dal/dashboard";
import {
    getProductsForDashboard,
    getProductCountsByStatus,
    type ProductStatus,
} from "@/lib/dal/products";
import { ProductsList } from "@/components/sente/products-list";
import { NewProductButton } from "@/components/sente/new-product-button";

type SearchParams = Promise<{
    status?: string;
    search?: string;
    stock?: string;  // nouveau
}>;

type Params = Promise<{ slug: string }>;

export default async function ProduitsPage({
                                               params,
                                               searchParams,
                                           }: {
    params: Params;
    searchParams: SearchParams;
}) {
    const { slug } = await params;
    const sp = await searchParams;

    const ctx = await getDashboardContext(slug);

    // Cette page est réservée aux magasins
    if (ctx.org.org_type !== "magasin") {
        return (
            <div className="border border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">
                    Cette section est réservée aux magasins.
                </p>
            </div>
        );
    }

    // Filtre statut depuis URL
    const validStatuses: Array<ProductStatus | "all"> = [
        "all",
        "draft",
        "published",
        "archived",
    ];
    const statusFilter: ProductStatus | "all" = validStatuses.includes(
        sp.status as ProductStatus | "all"
    )
        ? (sp.status as ProductStatus | "all")
        : "all";

    const search = typeof sp.search === "string" ? sp.search : "";

    const VALID_STOCK = ["all", "out", "low", "alerts"] as const;
    type StockFilter = (typeof VALID_STOCK)[number];

    const stockRaw = sp.stock ?? "all";
    const stock: StockFilter = (VALID_STOCK as readonly string[]).includes(
        stockRaw
    )
        ? (stockRaw as StockFilter)
        : "all";

    const [products, counts] = await Promise.all([
        getProductsForDashboard({
            organization_id: ctx.org.id,
            status: statusFilter,
            search: search || undefined,
        }),
        getProductCountsByStatus(ctx.org.id),
    ]);

    return (
        <div className="space-y-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Catalogue
                    </p>
                    <h1 className="mt-2 font-display text-3xl tracking-tight">
                        Produits
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Gère ton catalogue. Les produits en brouillon ne sont pas visibles
                        sur ta vitrine.
                    </p>
                </div>
                <NewProductButton organizationId={ctx.org.id} slug={slug} />
            </header>

            <ProductsList
                slug={slug}
                products={products}
                counts={counts}
                currentStatus={statusFilter}
                currentSearch={search}
                currentStock={stock}
            />
        </div>
    );
}