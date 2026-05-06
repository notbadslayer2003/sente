"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrgMember, assertOrgMemberByProductId } from "@/lib/auth/assert-org-member";
import { zUuid } from "@/lib/utils/zod-helpers";
import { canPublishProduct } from "@/lib/dal/feature-gate";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

// =============================================================================
// 1. Création d'un draft (via RPC create_product_draft)
// =============================================================================

const CreateProductSchema = z.object({
    organization_id: zUuid,
    // category_id facultatif pour gift_card (la RPC force la bonne catégorie)
    // mais on l'exige côté Zod pour physical
    category_id: zUuid.optional(),
    name: z
        .string()
        .min(2, "Nom trop court (min 2 caractères)")
        .max(150, "Nom trop long (max 150 caractères)"),
    short_desc: z
        .string()
        .max(250, "Description courte trop longue (max 250)")
        .optional()
        .or(z.literal(""))
        .transform((v) => (v && v.length > 0 ? v : null)),
    brand: z
        .string()
        .max(80, "Marque trop longue (max 80)")
        .optional()
        .or(z.literal(""))
        .transform((v) => (v && v.length > 0 ? v : null)),
    kind: z.enum(["physical", "gift_card"]).default("physical"),
});

export async function createProductDraftAction(
    formData: FormData
): Promise<ActionResult<{ product_id: string }>> {
    const categoryRaw = formData.get("category_id");
    const shortDescRaw = formData.get("short_desc");
    const brandRaw = formData.get("brand");

    const parsed = CreateProductSchema.safeParse({
        organization_id: formData.get("organization_id"),
        category_id:
            typeof categoryRaw === "string" && categoryRaw.length > 0
                ? categoryRaw
                : undefined,
        name: formData.get("name"),
        short_desc:
            typeof shortDescRaw === "string" && shortDescRaw.length > 0
                ? shortDescRaw
                : "",
        brand:
            typeof brandRaw === "string" && brandRaw.length > 0 ? brandRaw : "",
        kind: formData.get("kind") ?? "physical",
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Paramètres invalides",
        };
    }

    // Pour les produits physiques, la catégorie est obligatoire
    if (parsed.data.kind === "physical" && !parsed.data.category_id) {
        return { ok: false, error: "Catégorie requise" };
    }

    const auth = await assertOrgMember(parsed.data.organization_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();

    // Pour gift_card, on passe un category_id placeholder — la RPC
    // l'écrasera de toute façon avec la catégorie 'cartes-cadeaux'.
    const categoryIdToPass =
        parsed.data.kind === "gift_card"
            ? "00000000-0000-0000-0099-000000000001"
            : parsed.data.category_id!;

    const { data, error } = await supabase.rpc("create_product_draft", {
        p_organization_id: parsed.data.organization_id,
        p_category_id: categoryIdToPass,
        p_name: parsed.data.name,
        p_short_desc: parsed.data.short_desc ?? undefined,
        p_brand: parsed.data.brand ?? undefined,
        p_kind: parsed.data.kind,
    });

    if (error) {
        console.error("create_product_draft failed:", error);
        return { ok: false, error: humanizeProductError(error.message) };
    }
    if (!data) return { ok: false, error: "Erreur inattendue" };

    revalidatePath(`/dashboard/[slug]/produits`, "page");

    return { ok: true, data: { product_id: data as string } };
}

// =============================================================================
// 2. Update info produit (UPDATE direct, RLS protège)
// =============================================================================

const UpdateProductInfoSchema = z.object({
    product_id: zUuid,
    category_id: zUuid,
    name: z.string().min(2).max(150),
    short_desc: z.string().max(250).optional().or(z.literal("")),
    full_desc: z.string().max(8000).optional().or(z.literal("")),
    brand: z.string().max(80).optional().or(z.literal("")),
    tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    variant_dimensions: z.array(z.string().min(1).max(40)).max(3).optional(),
});

export async function updateProductInfoAction(
    formData: FormData
): Promise<ActionResult> {
    const tagsRaw = formData.get("tags");
    const dimensionsRaw = formData.get("variant_dimensions");

    let tags: string[] | undefined;
    let dimensions: string[] | undefined;
    try {
        if (typeof tagsRaw === "string" && tagsRaw.length > 0) {
            tags = JSON.parse(tagsRaw);
        }
        if (typeof dimensionsRaw === "string" && dimensionsRaw.length > 0) {
            dimensions = JSON.parse(dimensionsRaw);
        }
    } catch {
        return { ok: false, error: "Format invalide pour tags ou dimensions" };
    }

    const parsed = UpdateProductInfoSchema.safeParse({
        product_id: formData.get("product_id"),
        category_id: formData.get("category_id"),
        name: formData.get("name"),
        short_desc: formData.get("short_desc"),
        full_desc: formData.get("full_desc"),
        brand: formData.get("brand"),
        tags,
        variant_dimensions: dimensions,
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Paramètres invalides",
        };
    }

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();

    // Récupère le kind du produit pour adapter la validation
    const { data: existingProduct } = await supabase
        .from("products")
        .select("kind")
        .eq("id", parsed.data.product_id)
        .maybeSingle();

    if (!existingProduct) {
        return { ok: false, error: "Produit introuvable" };
    }

    const isGiftCard = existingProduct.kind === "gift_card";
    const GIFT_CARD_CATEGORY_ID = "00000000-0000-0000-0099-000000000001";

    // Pour gift_card : on force la catégorie cartes-cadeaux et on ignore brand/tags/dimensions
    let categoryIdToSave = parsed.data.category_id;
    if (isGiftCard) {
        categoryIdToSave = GIFT_CARD_CATEGORY_ID;
    } else {
        // Vérif catégorie est niveau 2 uniquement pour produits physiques
        const { data: category } = await supabase
            .from("product_categories")
            .select("parent_id")
            .eq("id", parsed.data.category_id)
            .maybeSingle();
        if (!category || category.parent_id === null) {
            return {
                ok: false,
                error: "Choisis une sous-catégorie (pas une catégorie racine)",
            };
        }
    }

    const { error } = await supabase
        .from("products")
        .update({
            category_id: categoryIdToSave,
            name: parsed.data.name,
            short_desc: parsed.data.short_desc || null,
            full_desc: parsed.data.full_desc || null,
            brand: isGiftCard ? null : parsed.data.brand || null,
            tags: isGiftCard ? [] : (parsed.data.tags ?? []),
            variant_dimensions: isGiftCard ? [] : (parsed.data.variant_dimensions ?? []),
        })
        .eq("id", parsed.data.product_id);

    if (error) {
        console.error("updateProductInfo failed:", error);
        return { ok: false, error: "Erreur de mise à jour." };
    }

    revalidatePath(`/dashboard/[slug]/produits`, "page");
    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    revalidatePath(`/magasins/[slug]/boutique`, "page");
    revalidatePath(`/magasins/[slug]/boutique/[product-slug]`, "page");

    return { ok: true };
}

// =============================================================================
// 3. Publication d'un produit (RPC publish_product)
// =============================================================================

const PublishProductSchema = z.object({
    product_id: zUuid,
});

export async function publishProductAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = PublishProductSchema.safeParse({
        product_id: formData.get("product_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;
    if (!auth.organizationId) {
        return { ok: false, error: "Organisation introuvable" };
    }

    // Feature gate : limite de produits publiés selon plan
    const gate = await canPublishProduct(auth.organizationId);
    if (!gate.ok) {
        return { ok: false, error: gate.reason };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("publish_product", {
        p_product_id: parsed.data.product_id,
    });

    if (error) {
        console.error("publish_product failed:", error);
        return { ok: false, error: humanizeProductError(error.message) };
    }

    revalidatePath(`/dashboard/[slug]/produits`, "page");
    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    revalidatePath(`/magasins/[slug]/boutique`, "page");

    return { ok: true };
}

// =============================================================================
// 4. Archivage / dépublication (UPDATE direct status='archived')
// =============================================================================

const ArchiveProductSchema = z.object({
    product_id: zUuid,
});

export async function archiveProductAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ArchiveProductSchema.safeParse({
        product_id: formData.get("product_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();
    const { error } = await supabase
        .from("products")
        .update({ status: "archived" })
        .eq("id", parsed.data.product_id);

    if (error) {
        console.error("archiveProduct failed:", error);
        return { ok: false, error: "Erreur lors de l'archivage." };
    }

    revalidatePath(`/dashboard/[slug]/produits`, "page");
    revalidatePath(`/magasins/[slug]/boutique`, "page");
    revalidatePath(`/magasins/[slug]/boutique/[product-slug]`, "page");

    return { ok: true };
}

// =============================================================================
// 5. Réactivation (archived → draft)
// =============================================================================

const UnarchiveProductSchema = z.object({
    product_id: zUuid,
});

export async function unarchiveProductAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = UnarchiveProductSchema.safeParse({
        product_id: formData.get("product_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();
    const { error } = await supabase
        .from("products")
        .update({ status: "draft" })
        .eq("id", parsed.data.product_id)
        .eq("status", "archived"); // safeguard : on ne réactive QUE depuis archived

    if (error) {
        console.error("unarchiveProduct failed:", error);
        return { ok: false, error: "Erreur lors de la réactivation." };
    }

    revalidatePath(`/dashboard/[slug]/produits`, "page");
    return { ok: true };
}

// =============================================================================
// 6. Soft delete (RPC soft_delete_product)
// =============================================================================

const SoftDeleteProductSchema = z.object({
    product_id: zUuid,
});

export async function softDeleteProductAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = SoftDeleteProductSchema.safeParse({
        product_id: formData.get("product_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();
    const { error } = await supabase.rpc("soft_delete_product", {
        p_product_id: parsed.data.product_id,
    });

    if (error) {
        console.error("soft_delete_product failed:", error);
        return { ok: false, error: humanizeProductError(error.message) };
    }

    revalidatePath(`/dashboard/[slug]/produits`, "page");
    revalidatePath(`/magasins/[slug]/boutique`, "page");

    return { ok: true };
}

// =============================================================================
// Helpers
// =============================================================================

function humanizeProductError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("authentification requise")) return "Session expirée, reconnecte-toi.";
    if (lower.includes("pas membre")) return "Accès refusé.";
    if (lower.includes("seuls les magasins")) return "Seuls les magasins peuvent créer des produits.";
    if (lower.includes("sous-catégorie")) return "Choisis une sous-catégorie (pas une racine).";
    if (lower.includes("nom invalide")) return "Nom invalide (2 à 150 caractères).";
    if (lower.includes("photo")) return "Ajoute au moins une photo avant de publier.";
    if (lower.includes("variante active")) return "Aucune variante active. Ajoute au moins une variante.";
    if (lower.includes("prix réel")) return "Renseigne un prix > 1€ sur tes variantes avant de publier.";
    if (lower.includes("archivé")) return "Produit archivé. Réactive-le avant de publier.";
    if (lower.includes("slug unique")) return "Impossible de générer un nom d'URL unique. Renomme légèrement.";
    return msg;
}