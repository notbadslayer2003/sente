import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export type MarketplaceListing = Database['public']['Tables']['marketplace_listings']['Row']
export type MarketplaceListingCondition =
    Database['public']['Enums']['marketplace_listing_condition']

/**
 * Listing avec ses relations couramment affichées.
 * Photos triées par position, première (couverture) en index 0.
 */
export type MarketplaceListingWithRelations = MarketplaceListing & {
    category: { id: string; slug: string; name_fr: string; parent_id: string | null } | null
    brand: { id: string; slug: string; name: string } | null
    photos: Array<{ storage_path: string; position: number }>
    seller: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export type MarketplaceListingsFilters = {
    /** Slug de catégorie N1 ou N2. Si N1, inclut tous les enfants N2. */
    categorySlug?: string
    /** Slug de marque verified */
    brandSlug?: string
    /** Filtrage état (multi-sélection) */
    conditions?: MarketplaceListingCondition[]
    minPriceCents?: number
    maxPriceCents?: number
    /** Texte libre cherché dans title + description (ilike) */
    search?: string
    /** Pays — réutilise enum country_code existant */
    country?: 'BE' | 'FR'
    /** Tri */
    sort?: 'recent' | 'price_asc' | 'price_desc' | 'popular'
    /** Pagination 0-indexée */
    page?: number
    pageSize?: number
}

const DEFAULT_PAGE_SIZE = 24

/**
 * Lecture publique : liste paginée des listings active non supprimés.
 * Exclut tout ce qui n'est pas 'active' AND deleted_at IS NULL (RLS le garantit côté
 * anon, mais on filtre explicitement aussi pour les Server Actions admin).
 */
export async function getMarketplaceListings(
    filters: MarketplaceListingsFilters = {}
): Promise<{ items: MarketplaceListingWithRelations[]; total: number }> {
    const supabase = await createClient()

    const page = filters.page ?? 0
    const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE

    let query = supabase
        .from('marketplace_listings')
        .select(
            `
        *,
        category:marketplace_categories!category_id(id, slug, name_fr, parent_id),
        brand:marketplace_brands!brand_id(id, slug, name),
        photos:marketplace_listing_photos(storage_path, position),
        seller:profiles!seller_user_id(id, full_name, avatar_url)
      `,
            { count: 'exact' }
        )
        .eq('status', 'active')
        .is('deleted_at', null)

    // Catégorie : si N1, on inclut tous les enfants N2
    if (filters.categorySlug) {
        const { data: cat } = await supabase
            .from('marketplace_categories')
            .select('id, parent_id')
            .eq('slug', filters.categorySlug)
            .maybeSingle()

        if (cat) {
            if (cat.parent_id === null) {
                // N1 : trouver tous les enfants
                const { data: children } = await supabase
                    .from('marketplace_categories')
                    .select('id')
                    .eq('parent_id', cat.id)
                const ids = [cat.id, ...(children ?? []).map((c) => c.id)]
                query = query.in('category_id', ids)
            } else {
                query = query.eq('category_id', cat.id)
            }
        } else {
            // Slug invalide → résultat vide
            return { items: [], total: 0 }
        }
    }

    if (filters.brandSlug) {
        const { data: brand } = await supabase
            .from('marketplace_brands')
            .select('id')
            .eq('slug', filters.brandSlug)
            .maybeSingle()

        if (brand) {
            query = query.eq('brand_id', brand.id)
        } else {
            return { items: [], total: 0 }
        }
    }

    if (filters.conditions && filters.conditions.length > 0) {
        query = query.in('condition', filters.conditions)
    }

    if (filters.minPriceCents !== undefined) {
        query = query.gte('price_cents', filters.minPriceCents)
    }

    if (filters.maxPriceCents !== undefined) {
        query = query.lte('price_cents', filters.maxPriceCents)
    }

    if (filters.country) {
        query = query.eq('country', filters.country)
    }

    if (filters.search && filters.search.trim().length > 0) {
        const term = filters.search.trim().replace(/[%_]/g, '')
        // Recherche sur title et description. Pour de la recherche full-text plus
        // performante on passera à tsvector + index GIN en V2.
        query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
    }

    // Tri
    switch (filters.sort) {
        case 'price_asc':
            query = query.order('price_cents', { ascending: true })
            break
        case 'price_desc':
            query = query.order('price_cents', { ascending: false })
            break
        case 'popular':
            query = query.order('favorite_count', { ascending: false })
            break
        case 'recent':
        default:
            query = query.order('created_at', { ascending: false })
    }

    // Pagination
    query = query.range(page * pageSize, page * pageSize + pageSize - 1)

    const { data, error, count } = await query

    if (error) throw error

    // Tri photos par position (Supabase ne le fait pas pour les jointures imbriquées)
    const items = ((data ?? []) as unknown as MarketplaceListingWithRelations[]).map((l) => ({
        ...l,
        photos: [...l.photos].sort((a, b) => a.position - b.position),
    }))

    return { items, total: count ?? 0 }
}

/**
 * Page détail d'un listing. Inclut toutes ses photos.
 * RLS gère la visibilité : si pas active, seul le seller / admin voit.
 */
export async function getMarketplaceListingById(
    id: string
): Promise<MarketplaceListingWithRelations | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('marketplace_listings')
        .select(`
      *,
      category:marketplace_categories!category_id(id, slug, name_fr, parent_id),
      brand:marketplace_brands!brand_id(id, slug, name),
      photos:marketplace_listing_photos(storage_path, position),
      seller:profiles!seller_user_id(id, full_name, avatar_url)
    `)
        .eq('id', id)
        .maybeSingle()

    if (error) throw error
    if (!data) return null

    const listing = data as unknown as MarketplaceListingWithRelations
    return {
        ...listing,
        photos: [...listing.photos].sort((a, b) => a.position - b.position),
    }
}

/**
 * Listings d'un vendeur donné — pour son profil public et son dashboard.
 * Si seller_user_id = courant, retourne tous les statuts. Sinon que les actives.
 * RLS filtre déjà mais on est explicite ici pour la lisibilité.
 */
export async function getMarketplaceListingsBySeller(
    sellerId: string,
    options: { includeAllStatuses?: boolean; limit?: number } = {}
): Promise<MarketplaceListingWithRelations[]> {
    const supabase = await createClient()

    let query = supabase
        .from('marketplace_listings')
        .select(`
      *,
      category:marketplace_categories!category_id(id, slug, name_fr, parent_id),
      brand:marketplace_brands!brand_id(id, slug, name),
      photos:marketplace_listing_photos(storage_path, position),
      seller:profiles!seller_user_id(id, full_name, avatar_url)
    `)
        .eq('seller_user_id', sellerId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

    if (!options.includeAllStatuses) {
        query = query.eq('status', 'active')
    }

    if (options.limit) {
        query = query.limit(options.limit)
    }

    const { data, error } = await query
    if (error) throw error

    return ((data ?? []) as unknown as MarketplaceListingWithRelations[]).map((l) => ({
        ...l,
        photos: [...l.photos].sort((a, b) => a.position - b.position),
    }))
}

export type MarketplaceListingStatus =
    Database["public"]["Enums"]["marketplace_listing_status"];

export async function getMyListings(options: {
    statuses?: MarketplaceListingStatus[];
    limit?: number;
} = {}): Promise<MarketplaceListingWithRelations[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
        .from("marketplace_listings")
        .select(`
      *,
      category:marketplace_categories!category_id(id, slug, name_fr, parent_id),
      brand:marketplace_brands!brand_id(id, slug, name),
      photos:marketplace_listing_photos(storage_path, position),
      seller:profiles!seller_user_id(id, full_name, avatar_url)
    `)
        .eq("seller_user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

    if (options.statuses && options.statuses.length > 0) {
        query = query.in("status", options.statuses);
    }

    if (options.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data ?? []) as unknown as MarketplaceListingWithRelations[]).map((l) => ({
        ...l,
        photos: [...l.photos].sort((a, b) => a.position - b.position),
    }));
}

// =============================================================================
// AJOUT à lib/dal/marketplace-listings.ts (à coller à la fin du fichier existant)
// =============================================================================
// Ne pas dupliquer les imports déjà présents en haut du fichier
// (createClient, type MarketplaceListingWithRelations, etc.)
// =============================================================================

export type MarketplacePublicListingsFilters = {
    categorySlug?: string;
    condition?: MarketplaceListingCondition;
    country?: "BE" | "FR";
    city?: string;
    search?: string;
    minPriceCents?: number;
    maxPriceCents?: number;
    sort?: "recent" | "price_asc" | "price_desc";
    page?: number;
    pageSize?: number;
};

export type MarketplacePublicListingsResult = {
    items: MarketplaceListingWithRelations[];
    total: number;
    page: number;
    pageSize: number;
};

/**
 * Liste les annonces actives publiques (pour la grille browse).
 * Si une catégorie N1 est filtrée, on inclut aussi les annonces de ses N2.
 */
export async function getMarketplacePublicListings(
    opts: MarketplacePublicListingsFilters = {}
): Promise<MarketplacePublicListingsResult> {
    const supabase = await createClient();
    const page = opts.page && opts.page > 0 ? opts.page : 1;
    const pageSize = Math.min(opts.pageSize ?? 24, 100);
    const offset = (page - 1) * pageSize;

    // Lookup categorie pour récupérer ses ids (et inclure les enfants si N1)
    let categoryIds: string[] | null = null;
    if (opts.categorySlug) {
        const { data: cat } = await supabase
            .from("marketplace_categories")
            .select("id, parent_id")
            .eq("slug", opts.categorySlug)
            .maybeSingle();

        if (cat) {
            if (cat.parent_id === null) {
                // N1 : on inclut aussi les enfants N2
                const { data: children } = await supabase
                    .from("marketplace_categories")
                    .select("id")
                    .eq("parent_id", cat.id);
                categoryIds = [cat.id, ...(children?.map((c) => c.id) ?? [])];
            } else {
                categoryIds = [cat.id];
            }
        } else {
            // Slug catégorie inconnu → résultat vide
            return { items: [], total: 0, page, pageSize };
        }
    }

    let query = supabase
        .from("marketplace_listings")
        .select(
            `
      *,
      category:marketplace_categories!category_id(id, slug, name_fr, parent_id),
      brand:marketplace_brands!brand_id(id, slug, name),
      photos:marketplace_listing_photos(storage_path, position),
      seller:profiles!seller_user_id(id, full_name, avatar_url)
    `,
            { count: "exact" }
        )
        .eq("status", "active")
        .is("deleted_at", null)
        .gt("expires_at", new Date().toISOString());

    if (categoryIds) query = query.in("category_id", categoryIds);
    if (opts.condition) query = query.eq("condition", opts.condition);
    if (opts.country) query = query.eq("country", opts.country);
    if (opts.city) query = query.ilike("city", `%${opts.city}%`);
    if (opts.minPriceCents !== undefined)
        query = query.gte("price_cents", opts.minPriceCents);
    if (opts.maxPriceCents !== undefined)
        query = query.lte("price_cents", opts.maxPriceCents);
    if (opts.search) {
        const q = opts.search.replace(/[%_]/g, ""); // basic sanitize ILIKE
        query = query.or(
            `title.ilike.%${q}%,description.ilike.%${q}%`
        );
    }

    if (opts.sort === "price_asc") {
        query = query.order("price_cents", { ascending: true });
    } else if (opts.sort === "price_desc") {
        query = query.order("price_cents", { ascending: false });
    } else {
        query = query.order("created_at", { ascending: false });
    }

    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const items = ((data ?? []) as unknown as MarketplaceListingWithRelations[]).map(
        (l) => ({
            ...l,
            photos: [...l.photos].sort((a, b) => a.position - b.position),
        })
    );

    return {
        items,
        total: count ?? 0,
        page,
        pageSize,
    };
}

/**
 * Récupère un listing pour la page détail publique.
 * Retourne null si le listing n'est pas active ou n'existe pas.
 */
export async function getMarketplaceListingForPublic(
    id: string
): Promise<MarketplaceListingWithRelations | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("marketplace_listings")
        .select(
            `
      *,
      category:marketplace_categories!category_id(id, slug, name_fr, parent_id),
      brand:marketplace_brands!brand_id(id, slug, name),
      photos:marketplace_listing_photos(id, storage_path, position),
      seller:profiles!seller_user_id(id, full_name, avatar_url)
    `
        )
        .eq("id", id)
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const listing = data as unknown as MarketplaceListingWithRelations;
    return {
        ...listing,
        photos: [...listing.photos].sort((a, b) => a.position - b.position),
    };
}