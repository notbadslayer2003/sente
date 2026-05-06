import { notFound } from "next/navigation";
import Link from "next/link";
import {
    getPublishedProductBySlug,
    getPublishedProductsByOrg,
} from "@/lib/dal/products";
import { getShopSettingsOrDefaults } from "@/lib/dal/shop-settings";
import { ProductDetailClient } from "@/components/sente/product-detail-client";
import { ProductCard } from "@/components/sente/product-card";

type Params = Promise<{ slug: string; "product-slug": string }>;

export default async function ProductDetailPage({
                                                    params,
                                                }: {
    params: Params;
}) {
    const { slug, "product-slug": productSlug } = await params;

    const product = await getPublishedProductBySlug({
        org_slug: slug,
        product_slug: productSlug,
    });

    if (!product) notFound();

    // Charge en parallèle : config livraison + 4 produits suggérés du même magasin
    const [shopSettings, related] = await Promise.all([
        getShopSettingsOrDefaults(product.organization.id),
        getPublishedProductsByOrg({
            organization_id: product.organization.id,
            limit: 5, // 4 + le produit courant qu'on filtrera
        }),
    ]);

    const relatedProducts = related
        .filter((p) => p.id !== product.id)
        .slice(0, 4);

    return (
        <section className="bg-background min-h-screen pt-24 pb-16">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                {/* Breadcrumb */}
                <nav className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6 flex flex-wrap items-center gap-2">
                    <Link
                        href={`/magasins/${slug}`}
                        className="hover:text-accent transition-colors"
                    >
                        {product.organization.name}
                    </Link>
                    <span>›</span>
                    <Link
                        href={`/magasins/${slug}/boutique`}
                        className="hover:text-accent transition-colors"
                    >
                        Boutique
                    </Link>
                    <span>›</span>
                    {product.category.parent_name && (
                        <>
                            <span className="text-muted-foreground">
                                {product.category.parent_name}
                            </span>
                            <span>›</span>
                        </>
                    )}
                    <span className="text-foreground truncate max-w-[200px]">
                        {product.name}
                    </span>
                </nav>

                <ProductDetailClient
                    product={product}
                    shopSettings={shopSettings}
                />

                {/* Produits du même magasin */}
                {relatedProducts.length > 0 && (
                    <div className="mt-20 pt-10 border-t border-border">
                        <h2 className="font-display text-2xl tracking-tight mb-8">
                            Aussi dans cette boutique
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {relatedProducts.map((p) => (
                                <ProductCard
                                    key={p.id}
                                    product={p}
                                    orgSlug={slug}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}