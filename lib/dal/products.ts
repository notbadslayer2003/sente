import { createClient } from "@/lib/supabase/server";

const LOW_STOCK_THRESHOLD = 5;
// =============================================================================
// Types
// =============================================================================

export type ProductStatus = "draft" | "published" | "archived";
export type ProductKind = "physical" | "gift_card" | "subscription_box";

export type ProductVariant = {
    id: string;
    sku: string;
    price_cents: number;
    compare_at_price_cents: number | null;
    stock_quantity: number | null;
    options: Record<string, string>;
    display_order: number;
    is_active: boolean;
};

export type ProductListItem = {
    id: string;
    organization_id: string;
    slug: string;
    name: string;
    short_desc: string | null;
    brand: string | null;
    kind: ProductKind;
    status: ProductStatus;
    photos: string[];
    tags: string[];
    category: {
        id: string;
        slug: string;
        name: string;
        parent_name: string | null;
    };
    // Min/max prices à travers les variantes actives, pour affichage card
    min_price_cents: number;
    max_price_cents: number;
    has_stock: boolean; // au moins une variante avec stock > 0 ou stock NULL (illimité)
    // Indicateurs stock dérivés (pour filtres dashboard et badges).
    // Calculés sur les variantes actives uniquement.
    has_out_of_stock_variant: boolean;     // au moins une variante avec stock = 0
    has_low_stock_variant: boolean;        // au moins une variante 0 < stock <= 5
    has_only_unlimited_stock: boolean;     // toutes les variantes en stock NULL
    variants_count: number;
    published_at: string | null;
    created_at: string;
    updated_at: string;
};

export type ProductDetail = ProductListItem & {
    full_desc: string | null;
    variant_dimensions: string[];
    variants: ProductVariant[];
    organization: {
        id: string;
        slug: string;
        name: string;
    };
};

// =============================================================================
// Mappers (interne)
// =============================================================================

type RawProductRow = {
    id: string;
    organization_id: string;
    slug: string;
    name: string;
    short_desc: string | null;
    full_desc?: string | null;
    brand: string | null;
    kind: ProductKind;
    status: ProductStatus;
    photos: string[];
    tags: string[];
    variant_dimensions?: string[];
    published_at: string | null;
    created_at: string;
    updated_at: string;
    category:
        | {
        id: string;
        slug: string;
        name: string;
        parent: { name: string } | { name: string }[] | null;
    }
        | Array<{
        id: string;
        slug: string;
        name: string;
        parent: { name: string } | { name: string }[] | null;
    }>
        | null;
    organization?:
        | { id: string; slug: string; name: string }
        | { id: string; slug: string; name: string }[]
        | null;
    variants:
        | ProductVariant[]
        | Array<{
        id: string;
        sku: string;
        price_cents: number;
        compare_at_price_cents: number | null;
        stock_quantity: number | null;
        options: Record<string, string>;
        display_order: number;
        is_active: boolean;
    }>
        | null;
};

function mapToProductListItem(row: RawProductRow): ProductListItem | null {
    console.log("[MAPPER] Processing product:", row.id, row.name, row.kind);

    const cat = Array.isArray(row.category) ? row.category[0] : row.category;
    if (!cat) {
        // Defensive: si le produit n'a pas de catégorie résolue (rare), on retourne
        // quand même les infos de base avec une catégorie vide. Un produit sans
        // catégorie en DB est un état dégradé qu'il faut quand même afficher
        // pour permettre au magasin de le voir et le corriger.
        console.warn(`Product ${row.id} has no resolved category, using fallback`);
    }

    const parent = cat
        ? Array.isArray(cat.parent)
            ? cat.parent[0]
            : cat.parent
        : null;

    const allVariants = (row.variants ?? []) as ProductVariant[];
    const activeVariants = allVariants.filter((v) => v.is_active);

    const prices = activeVariants.map((v) => v.price_cents);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

    // Stock dispo = au moins une variante avec stock NULL (illimité) ou > 0
    const hasStock = activeVariants.some(
        (v) => v.stock_quantity === null || v.stock_quantity > 0
    );

    // Indicateurs dérivés pour filtres dashboard
    const hasOutOfStockVariant = activeVariants.some(
        (v) => v.stock_quantity === 0
    );
    const hasLowStockVariant = activeVariants.some(
        (v) =>
            v.stock_quantity !== null &&
            v.stock_quantity > 0 &&
            v.stock_quantity <= LOW_STOCK_THRESHOLD
    );
    const hasOnlyUnlimitedStock =
        activeVariants.length > 0 &&
        activeVariants.every((v) => v.stock_quantity === null);

    return {
        id: row.id,
        organization_id: row.organization_id,
        slug: row.slug,
        name: row.name,
        short_desc: row.short_desc,
        brand: row.brand,
        kind: row.kind,
        status: row.status,
        photos: row.photos ?? [],
        tags: row.tags ?? [],
        category: {
            id: cat?.id ?? "",
            slug: cat?.slug ?? "",
            name: cat?.name ?? "—",
            parent_name: parent?.name ?? null,
        },
        min_price_cents: minPrice,
        max_price_cents: maxPrice,
        has_stock: hasStock,
        has_out_of_stock_variant: hasOutOfStockVariant,
        has_low_stock_variant: hasLowStockVariant,
        has_only_unlimited_stock: hasOnlyUnlimitedStock,
        variants_count: activeVariants.length,
        published_at: row.published_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function mapToProductDetail(row: RawProductRow): ProductDetail | null {
    const base = mapToProductListItem(row);
    if (!base) return null;

    const org = Array.isArray(row.organization)
        ? row.organization[0]
        : row.organization;
    if (!org) return null;

    const variants = ((row.variants ?? []) as ProductVariant[]).sort(
        (a, b) => a.display_order - b.display_order
    );

    return {
        ...base,
        full_desc: row.full_desc ?? null,
        variant_dimensions: row.variant_dimensions ?? [],
        variants,
        organization: {
            id: org.id,
            slug: org.slug,
            name: org.name,
        },
    };
}

// =============================================================================
// Lecture publique (vitrine boutique)
// =============================================================================

/**
 * Liste les produits publiés d'un magasin (vitrine /magasins/[slug]/boutique).
 * Filtre les soft-deleted et les drafts. Pas besoin d'être authentifié.
 */
export async function getPublishedProductsByOrg(opts: {
    organization_id: string;
    category_id?: string;
    limit?: number;
    cursor?: string; // published_at du dernier produit chargé
}): Promise<ProductListItem[]> {
    const limit = opts.limit ?? 24;
    const supabase = await createClient();

    let q = supabase
        .from("products")
        .select(
            `id, organization_id, slug, name, short_desc, brand, kind, status,
             photos, tags, published_at, created_at, updated_at,
             category:product_categories!category_id(
                id, slug, name, parent_id,
                parent:product_categories!parent_id(name)
             ),
             variants:product_variants!product_id(
                id, sku, price_cents, compare_at_price_cents, stock_quantity,
                options, display_order, is_active
             )`
        )
        .eq("organization_id", opts.organization_id)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .limit(limit);

    if (opts.category_id) q = q.eq("category_id", opts.category_id);
    if (opts.cursor) q = q.lt("published_at", opts.cursor);

    const { data, error } = await q;
    if (error || !data) {
        if (error) console.error("getPublishedProductsByOrg failed:", error);
        return [];
    }

    return data
        .map((r) => mapToProductListItem(r as RawProductRow))
        .filter((p): p is ProductListItem => p !== null);
}

/**
 * Récupère le détail d'un produit publié par son slug + le slug du magasin.
 * Utilisé sur la page /magasins/[slug]/boutique/[product-slug].
 */
export async function getPublishedProductBySlug(opts: {
    org_slug: string;
    product_slug: string;
}): Promise<ProductDetail | null> {
    const supabase = await createClient();

    // On cherche d'abord l'org par slug pour avoir son id
    const { data: org } = await supabase
        .from("organizations")
        .select("id, slug, name")
        .eq("slug", opts.org_slug)
        .eq("org_type", "magasin")
        .is("deleted_at", null)
        .maybeSingle();

    if (!org) return null;

    const { data, error } = await supabase
        .from("products")
        .select(
            `id, organization_id, slug, name, short_desc, full_desc, brand, kind, status,
             photos, tags, variant_dimensions, published_at, created_at, updated_at,
             category:product_categories!category_id(
                id, slug, name, parent_id,
                parent:product_categories!parent_id(name)
             ),
             organization:organizations!organization_id(id, slug, name),
             variants:product_variants!product_id(
                id, sku, price_cents, compare_at_price_cents, stock_quantity,
                options, display_order, is_active
             )`
        )
        .eq("organization_id", org.id)
        .eq("slug", opts.product_slug)
        .eq("status", "published")
        .is("deleted_at", null)
        .maybeSingle();

    if (error) {
        console.error("getPublishedProductBySlug failed:", error);
        return null;
    }
    if (!data) return null;

    return mapToProductDetail(data as RawProductRow);
}

// =============================================================================
// Lecture dashboard membres (incluant drafts + archived)
// =============================================================================

/**
 * Liste tous les produits d'un magasin pour le dashboard (drafts + published + archived).
 * Réservé aux membres de l'org (filtré par RLS).
 */
export async function getProductsForDashboard(opts: {
    organization_id: string;
    status?: ProductStatus | "all";
    search?: string;
    limit?: number;
}): Promise<ProductListItem[]> {
    const limit = opts.limit ?? 50;
    const supabase = await createClient();

    let q = supabase
        .from("products")
        .select(
            `id, organization_id, slug, name, short_desc, brand, kind, status,
             photos, tags, published_at, created_at, updated_at,
             category:product_categories!category_id(
                id, slug, name, parent_id,
                parent:product_categories!parent_id(name)
             ),
             variants:product_variants!product_id(
                id, sku, price_cents, compare_at_price_cents, stock_quantity,
                options, display_order, is_active
             )`
        )
        .eq("organization_id", opts.organization_id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(limit);

    if (opts.status && opts.status !== "all") {
        q = q.eq("status", opts.status);
    }
    if (opts.search && opts.search.trim().length > 0) {
        q = q.ilike("name", `%${opts.search.trim()}%`);
    }

    const { data, error } = await q;
    if (error || !data) {
        if (error) console.error("getProductsForDashboard failed:", error);
        return [];
    }

    return data
        .map((r) => mapToProductListItem(r as RawProductRow))
        .filter((p): p is ProductListItem => p !== null);
}

/**
 * Détail produit pour le dashboard (peu importe le statut).
 * Membres uniquement (filtré par RLS).
 */
export async function getProductForDashboard(
    productId: string
): Promise<ProductDetail | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("products")
        .select(
            `id, organization_id, slug, name, short_desc, full_desc, brand, kind, status,
             photos, tags, variant_dimensions, published_at, created_at, updated_at,
             category:product_categories!category_id(
                id, slug, name, parent_id,
                parent:product_categories!parent_id(name)
             ),
             organization:organizations!organization_id(id, slug, name),
             variants:product_variants!product_id(
                id, sku, price_cents, compare_at_price_cents, stock_quantity,
                options, display_order, is_active
             )`
        )
        .eq("id", productId)
        .is("deleted_at", null)
        .maybeSingle();

    if (error) {
        console.error("getProductForDashboard failed:", error);
        return null;
    }
    if (!data) return null;

    return mapToProductDetail(data as RawProductRow);
}

/**
 * Compte les produits par statut pour un magasin (utile pour les badges du dashboard).
 */
export async function getProductCountsByStatus(
    organizationId: string
): Promise<Record<ProductStatus, number>> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("products")
        .select("status")
        .eq("organization_id", organizationId)
        .is("deleted_at", null);

    const counts: Record<ProductStatus, number> = {
        draft: 0,
        published: 0,
        archived: 0,
    };
    for (const row of data ?? []) {
        counts[row.status as ProductStatus]++;
    }
    return counts;
}

// =============================================================================
// Stock alerts (5.B)
// =============================================================================

export type StockAlertCounts = {
    out_of_stock: number;   // produits avec au moins 1 variante stock = 0
    low_stock: number;      // produits avec au moins 1 variante 0 < stock <= 5
    total_published: number;
};

/**
 * Compte les produits publiés du magasin par état de stock.
 * - out_of_stock : au moins une variante avec stock_quantity = 0
 * - low_stock : au moins une variante avec 0 < stock_quantity <= 5
 *
 * Un produit dont TOUTES les variantes sont en stock illimité (NULL) ne
 * remonte dans aucune alerte.
 */
export async function getStockAlertCounts(
    organizationId: string
): Promise<StockAlertCounts> {
    const supabase = await createClient();

    // On récupère tous les produits publiés avec leurs variantes
    const { data, error } = await supabase
        .from("products")
        .select(
            `id,
             variants:product_variants!product_id(
                stock_quantity, is_active
             )`
        )
        .eq("organization_id", organizationId)
        .eq("status", "published")
        .is("deleted_at", null);

    if (error || !data) {
        if (error) console.error("getStockAlertCounts failed:", error);
        return { out_of_stock: 0, low_stock: 0, total_published: 0 };
    }

    let outOfStock = 0;
    let lowStock = 0;

    for (const product of data) {
        const variants = (product.variants ?? []) as Array<{
            stock_quantity: number | null;
            is_active: boolean;
        }>;
        const activeVariants = variants.filter((v) => v.is_active);
        if (activeVariants.length === 0) continue;

        // Toutes les variantes en stock illimité ? → ignore
        const allUnlimited = activeVariants.every(
            (v) => v.stock_quantity === null
        );
        if (allUnlimited) continue;

        // Au moins une variante stock = 0
        const hasZero = activeVariants.some((v) => v.stock_quantity === 0);
        // Au moins une variante 0 < stock <= 5
        const hasLow = activeVariants.some(
            (v) =>
                v.stock_quantity !== null &&
                v.stock_quantity > 0 &&
                v.stock_quantity <= LOW_STOCK_THRESHOLD
        );

        if (hasZero) {
            outOfStock++;
        } else if (hasLow) {
            // On compte "low" seulement s'il n'y a pas déjà un "zero" sur le produit
            // (priorité à l'alerte la plus critique)
            lowStock++;
        }
    }

    return {
        out_of_stock: outOfStock,
        low_stock: lowStock,
        total_published: data.length,
    };
}

/**
 * Liste les produits avec problème de stock pour la vue dashboard "Alertes stock".
 * Retourne le détail des variantes concernées pour pouvoir afficher quoi est en
 * rupture / quoi est bas.
 */
export type StockAlertProduct = {
    id: string;
    slug: string;
    name: string;
    photos: string[];
    severity: "out_of_stock" | "low_stock";
    variants_alerts: Array<{
        variant_id: string;
        sku: string;
        variant_name: string | null;
        stock_quantity: number;
    }>;
};

export async function getStockAlertProducts(
    organizationId: string,
    limit: number = 20
): Promise<StockAlertProduct[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("products")
        .select(
            `id, slug, name, photos,
             variants:product_variants!product_id(
                id, sku, options, stock_quantity, is_active
             )`
        )
        .eq("organization_id", organizationId)
        .eq("status", "published")
        .is("deleted_at", null);

    if (error || !data) {
        if (error) console.error("getStockAlertProducts failed:", error);
        return [];
    }

    const alerts: StockAlertProduct[] = [];

    for (const product of data) {
        const variants = (product.variants ?? []) as Array<{
            id: string;
            sku: string;
            options: Record<string, string>;
            stock_quantity: number | null;
            is_active: boolean;
        }>;
        const activeVariants = variants.filter((v) => v.is_active);

        const problematicVariants = activeVariants
            .filter(
                (v) =>
                    v.stock_quantity !== null &&
                    v.stock_quantity <= LOW_STOCK_THRESHOLD
            )
            .map((v) => ({
                variant_id: v.id,
                sku: v.sku,
                variant_name:
                    Object.keys(v.options).length === 0
                        ? null
                        : Object.values(v.options).join(" / "),
                stock_quantity: v.stock_quantity ?? 0,
            }));

        if (problematicVariants.length === 0) continue;

        const hasZero = problematicVariants.some(
            (v) => v.stock_quantity === 0
        );

        alerts.push({
            id: product.id,
            slug: product.slug,
            name: product.name,
            photos: product.photos ?? [],
            severity: hasZero ? "out_of_stock" : "low_stock",
            variants_alerts: problematicVariants.sort(
                (a, b) => a.stock_quantity - b.stock_quantity
            ),
        });
    }

    // Trie : ruptures d'abord, puis bas
    alerts.sort((a, b) => {
        if (a.severity === b.severity) return 0;
        return a.severity === "out_of_stock" ? -1 : 1;
    });

    return alerts.slice(0, limit);
}