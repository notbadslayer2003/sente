import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type MemberRole = Database["public"]["Enums"]["member_role"];

export type AssertResult =
    | { ok: true; userId: string; role: MemberRole }
    | { ok: false; error: string };

/**
 * Vérifie que l'utilisateur connecté est membre actif d'une organisation.
 * Retourne le rôle pour permettre des checks fins ensuite.
 *
 * Usage en début de server action :
 *   const auth = await assertOrgMember(orgId);
 *   if (!auth.ok) return { ok: false, error: auth.error };
 *   // auth.userId, auth.role disponibles
 */
export async function assertOrgMember(
    organizationId: string
): Promise<AssertResult> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .maybeSingle();

    if (!membership) return { ok: false, error: "Accès refusé" };

    return { ok: true, userId: user.id, role: membership.role };
}

/**
 * Variante : vérifie membership ET résout l'organization_id à partir d'un product_id.
 * Évite un round-trip dans les server actions qui manipulent une variante :
 * on a juste l'id de la variante en input, pas l'org.
 */
export async function assertOrgMemberByProductId(
    productId: string
): Promise<AssertResult & { organizationId?: string }> {
    const supabase = await createClient();

    const { data: product } = await supabase
        .from("products")
        .select("organization_id")
        .eq("id", productId)
        .is("deleted_at", null)
        .maybeSingle();

    if (!product) return { ok: false, error: "Produit introuvable" };

    const auth = await assertOrgMember(product.organization_id);
    if (!auth.ok) return auth;

    return { ...auth, organizationId: product.organization_id };
}

/**
 * Variante pour les variantes (méta) : résout via product_variants → products.
 */
export async function assertOrgMemberByVariantId(
    variantId: string
): Promise<AssertResult & { organizationId?: string; productId?: string }> {
    const supabase = await createClient();

    const { data: variant } = await supabase
        .from("product_variants")
        .select("product_id, products!product_id(organization_id, deleted_at)")
        .eq("id", variantId)
        .maybeSingle();

    if (!variant) return { ok: false, error: "Variante introuvable" };

    const product = Array.isArray(variant.products)
        ? variant.products[0]
        : variant.products;
    if (!product || product.deleted_at !== null) {
        return { ok: false, error: "Produit introuvable" };
    }

    const auth = await assertOrgMember(product.organization_id);
    if (!auth.ok) return auth;

    return {
        ...auth,
        organizationId: product.organization_id,
        productId: variant.product_id,
    };
}