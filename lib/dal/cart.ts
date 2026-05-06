import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

export type CartItem = {
    id: string;
    cart_id: string;
    product_variant_id: string;
    quantity: number;
    created_at: string;
    updated_at: string;
    // Données jointes
    variant: {
        id: string;
        sku: string;
        price_cents: number;
        compare_at_price_cents: number | null;
        stock_quantity: number | null;
        options: Record<string, string>;
        is_active: boolean;
    };
    product: {
        id: string;
        slug: string;
        name: string;
        brand: string | null;
        photos: string[];
        status: string;
        deleted_at: string | null;
    };
};

export type CartGroup = {
    cart_id: string;
    organization: {
        id: string;
        slug: string;
        name: string;
        cover_image_url: string | null;
        stripe_charges_enabled: boolean;
    };
    items: CartItem[];
    subtotal_cents: number;
    items_count: number;
    has_unavailable_items: boolean;
};

// =============================================================================
// Mappers internes
// =============================================================================

type RawCartItemRow = {
    id: string;
    cart_id: string;
    product_variant_id: string;
    quantity: number;
    created_at: string;
    updated_at: string;
    variant:
        | {
        id: string;
        sku: string;
        price_cents: number;
        compare_at_price_cents: number | null;
        stock_quantity: number | null;
        options: Record<string, string>;
        is_active: boolean;
        product:
            | {
            id: string;
            slug: string;
            name: string;
            brand: string | null;
            photos: string[];
            status: string;
            deleted_at: string | null;
        }
            | { id: string; slug: string; name: string; brand: string | null; photos: string[]; status: string; deleted_at: string | null }[]
            | null;
    }
        | Array<{
        id: string;
        sku: string;
        price_cents: number;
        compare_at_price_cents: number | null;
        stock_quantity: number | null;
        options: Record<string, string>;
        is_active: boolean;
        product: unknown;
    }>
        | null;
};

function mapToCartItem(row: RawCartItemRow): CartItem | null {
    const variant = Array.isArray(row.variant) ? row.variant[0] : row.variant;
    if (!variant) return null;

    const product = Array.isArray(variant.product)
        ? variant.product[0]
        : variant.product;
    if (!product) return null;

    return {
        id: row.id,
        cart_id: row.cart_id,
        product_variant_id: row.product_variant_id,
        quantity: row.quantity,
        created_at: row.created_at,
        updated_at: row.updated_at,
        variant: {
            id: variant.id,
            sku: variant.sku,
            price_cents: variant.price_cents,
            compare_at_price_cents: variant.compare_at_price_cents,
            stock_quantity: variant.stock_quantity,
            options: variant.options,
            is_active: variant.is_active,
        },
        product: {
            id: (product as { id: string }).id,
            slug: (product as { slug: string }).slug,
            name: (product as { name: string }).name,
            brand: (product as { brand: string | null }).brand,
            photos: (product as { photos: string[] }).photos ?? [],
            status: (product as { status: string }).status,
            deleted_at: (product as { deleted_at: string | null }).deleted_at,
        },
    };
}

function isItemUnavailable(item: CartItem): boolean {
    // Indispo si :
    //   - Variante désactivée
    //   - Produit dépublié ou supprimé
    //   - Stock insuffisant (NULL = illimité = OK)
    if (!item.variant.is_active) return true;
    if (item.product.status !== "published") return true;
    if (item.product.deleted_at !== null) return true;
    if (
        item.variant.stock_quantity !== null &&
        item.variant.stock_quantity < item.quantity
    ) {
        return true;
    }
    return false;
}

// =============================================================================
// Lectures publiques
// =============================================================================

/**
 * Retourne tous les paniers du user authentifié, groupés par magasin.
 * Un user peut avoir plusieurs paniers en parallèle (un par magasin).
 *
 * Si l'user n'est pas connecté, retourne tableau vide.
 */
export async function getMyCartGroups(): Promise<CartGroup[]> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: carts, error: cartsErr } = await supabase
        .from("carts")
        .select(
            `id,
             organization:organizations!organization_id(
                id, slug, name, cover_image_url, stripe_charges_enabled
             ),
             items:cart_items!cart_id(
                id, cart_id, product_variant_id, quantity, created_at, updated_at,
                variant:product_variants!product_variant_id(
                    id, sku, price_cents, compare_at_price_cents,
                    stock_quantity, options, is_active,
                    product:products!product_id(
                        id, slug, name, brand, photos, status, deleted_at
                    )
                )
             )`
        )
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

    if (cartsErr || !carts) {
        if (cartsErr) console.error("getMyCartGroups failed:", cartsErr);
        return [];
    }

    const groups: CartGroup[] = [];

    for (const cart of carts) {
        const org = Array.isArray(cart.organization)
            ? cart.organization[0]
            : cart.organization;
        if (!org) continue;

        const rawItems = (cart.items ?? []) as RawCartItemRow[];
        const items = rawItems
            .map(mapToCartItem)
            .filter((i): i is CartItem => i !== null);

        // Filtre les items dont la variante ou le produit a été hard-deleté
        // (rare mais possible avec ON DELETE CASCADE)
        if (items.length === 0) continue;

        const subtotal = items.reduce(
            (acc, it) => acc + it.variant.price_cents * it.quantity,
            0
        );
        const itemsCount = items.reduce((acc, it) => acc + it.quantity, 0);
        const hasUnavailable = items.some(isItemUnavailable);

        groups.push({
            cart_id: cart.id,
            organization: {
                id: org.id,
                slug: org.slug,
                name: org.name,
                cover_image_url: org.cover_image_url,
                stripe_charges_enabled: org.stripe_charges_enabled,
            },
            items,
            subtotal_cents: subtotal,
            items_count: itemsCount,
            has_unavailable_items: hasUnavailable,
        });
    }

    return groups;
}

/**
 * Compte le total d'items à travers TOUS les paniers du user (toutes orgs confondues).
 * Utilisé pour le badge dans le header.
 *
 * Retourne 0 si non connecté.
 */
export async function getMyCartItemsCount(): Promise<number> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    // On joint pour ne compter que les items dont le cart appartient au user
    const { data, error } = await supabase
        .from("cart_items")
        .select("quantity, cart:carts!cart_id(user_id)", { count: "exact" })
        .eq("cart.user_id", user.id);

    if (error || !data) {
        if (error) console.error("getMyCartItemsCount failed:", error);
        return 0;
    }

    return data.reduce((acc, row) => acc + (row.quantity ?? 0), 0);
}

/**
 * Indique si le user a au moins 1 item dans le panier d'un magasin spécifique.
 * Utilisé pour le bouton "Ajouter" → "Dans le panier" sur la page produit.
 */
export async function isVariantInCart(
    productVariantId: string
): Promise<{ inCart: boolean; quantity: number; cartItemId: string | null }> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { inCart: false, quantity: 0, cartItemId: null };

    const { data } = await supabase
        .from("cart_items")
        .select("id, quantity, cart:carts!cart_id(user_id)")
        .eq("product_variant_id", productVariantId)
        .eq("cart.user_id", user.id)
        .maybeSingle();

    if (!data) return { inCart: false, quantity: 0, cartItemId: null };

    return {
        inCart: true,
        quantity: data.quantity,
        cartItemId: data.id,
    };
}