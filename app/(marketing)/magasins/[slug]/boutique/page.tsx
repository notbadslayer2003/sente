import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
    getPublishedProductsByOrg,
    type ProductListItem,
} from "@/lib/dal/products";
import {
    getCategoryTree,
    type ProductCategoryTree,
} from "@/lib/dal/product-categories";
import { ShopHeader } from "@/components/sente/shop-header";
import { ShopFilters } from "@/components/sente/shop-filters";
import { ShopGrid } from "@/components/sente/shop-grid";

type SearchParams = Promise<{
    category?: string;
    search?: string;
    cursor?: string;
}>;

type Params = Promise<{ slug: string }>;

const PAGE_SIZE = 24;

export default async function BoutiquePage({
                                               params,
                                               searchParams,
                                           }: {
    params: Params;
    searchParams: SearchParams;
}) {
    const { slug } = await params;
    const sp = await searchParams;

    const supabase = await createClient();

    // Récupère le magasin par slug
    const { data: org } = await supabase
        .from("organizations")
        .select("id, slug, name, org_type, status, cover_image_url, photos, description, city")
        .eq("slug", slug)
        .eq("org_type", "magasin")
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

    if (!org) notFound();

    // Récupère la catégorie active si filtrée par slug
    let activeCategoryId: string | undefined;
    let activeCategoryName: string | undefined;
    if (sp.category) {
        const { data: cat } = await supabase
            .from("product_categories")
            .select("id, name, parent:product_categories!parent_id(name)")
            .eq("slug", sp.category)
            .maybeSingle();
        if (cat) {
            activeCategoryId = cat.id;
            const parent = Array.isArray(cat.parent) ? cat.parent[0] : cat.parent;
            activeCategoryName = parent
                ? `${parent.name} › ${cat.name}`
                : cat.name;
        }
    }

    const search = typeof sp.search === "string" ? sp.search.trim() : "";

    // Charge la liste de produits + l'arbre catégories en parallèle
    const [products, categoryTree] = await Promise.all([
        getPublishedProductsByOrg({
            organization_id: org.id,
            category_id: activeCategoryId,
            limit: PAGE_SIZE + 1, // +1 pour détecter "y a-t-il une page suivante"
            cursor: sp.cursor,
        }),
        getCategoryTree(),
    ]);

    // Filtre côté serveur sur le search (la DAL ne le fait pas car elle veut rester
    // simple ; on filtre ici par name/brand/tags)
    const filteredProducts = search
        ? products.filter((p) => {
            const haystack = [
                p.name,
                p.brand ?? "",
                ...p.tags,
            ]
                .join(" ")
                .toLowerCase();
            return haystack.includes(search.toLowerCase());
        })
        : products;

    // Détecte la pagination
    const hasMore = filteredProducts.length > PAGE_SIZE;
    const visibleProducts = hasMore
        ? filteredProducts.slice(0, PAGE_SIZE)
        : filteredProducts;

    const nextCursor = hasMore
        ? visibleProducts[visibleProducts.length - 1]?.published_at ?? undefined
        : undefined;

    // Filtre les catégories pour ne garder que celles qui ont des produits publiés
    // (évite d'afficher "Cannes mouche" si le magasin ne vend pas de mouche)
    const usedCategoryIds = new Set(products.map((p) => p.category.id));
    const usedRootIds = new Set<string>();
    const filteredTree = categoryTree
        .map((root) => ({
            ...root,
            children: root.children.filter((c) => usedCategoryIds.has(c.id)),
        }))
        .filter((root) => {
            if (root.children.length > 0) {
                usedRootIds.add(root.id);
                return true;
            }
            return false;
        });

    return (
        <section className="bg-background min-h-screen pt-24 pb-16">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                {/* Breadcrumb */}
                <nav className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-6">
                    <Link
                        href={`/magasins/${slug}`}
                        className="hover:text-accent transition-colors"
                    >
                        {org.name}
                    </Link>
                    <span className="mx-2">›</span>
                    <span className="text-foreground">Boutique</span>
                </nav>

                <ShopHeader
                    orgName={org.name}
                    orgSlug={org.slug}
                    description={org.description}
                    city={org.city}
                    coverUrl={org.cover_image_url}
                />

                <ShopFilters
                    slug={slug}
                    categoryTree={filteredTree}
                    activeCategorySlug={sp.category ?? null}
                    activeCategoryLabel={activeCategoryName ?? null}
                    initialSearch={search}
                />

                <ShopGrid
                    products={visibleProducts}
                    orgSlug={slug}
                    nextCursor={nextCursor}
                    activeCategorySlug={sp.category ?? null}
                    activeSearch={search}
                />
            </div>
        </section>
    );
}