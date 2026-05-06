"use server";

import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {
    assertOrgMemberByProductId,
    assertOrgMemberByVariantId,
} from "@/lib/auth/assert-org-member";
import { canAddVariantToProduct } from "@/lib/dal/feature-gate";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

// =============================================================================
// 1. Ajout d'une variante
// =============================================================================

const AddVariantSchema = z.object({
    product_id: z.string().uuid(),
    sku: z.string().min(1, "SKU requis").max(64, "SKU trop long (max 64)"),
    price_cents: z
        .number()
        .int("Prix entier requis (en centimes)")
        .positive("Prix doit être > 0")
        .max(10_000_000, "Prix trop élevé (max 100 000 €)"),
    compare_at_price_cents: z
        .number()
        .int()
        .positive()
        .max(10_000_000)
        .optional()
        .nullable(),
    stock_quantity: z
        .number()
        .int("Stock entier requis")
        .min(0, "Stock négatif impossible")
        .nullable()
        .optional(),
    options: z.record(z.string(), z.string()).optional(),
});

export async function addVariantAction(
    formData: FormData
): Promise<ActionResult<{ variant_id: string }>> {
    // Parse les champs numériques (FormData ne préserve pas les types)
    const priceRaw = formData.get("price_cents");
    const compareAtRaw = formData.get("compare_at_price_cents");
    const stockRaw = formData.get("stock_quantity");
    const optionsRaw = formData.get("options");

    let options: Record<string, string> | undefined;
    try {
        if (typeof optionsRaw === "string" && optionsRaw.length > 0) {
            options = JSON.parse(optionsRaw);
        }
    } catch {
        return {ok: false, error: "Format invalide pour les options"};
    }

    const parsed = AddVariantSchema.safeParse({
        product_id: formData.get("product_id"),
        sku: formData.get("sku"),
        price_cents: typeof priceRaw === "string" ? parseInt(priceRaw, 10) : undefined,
        compare_at_price_cents:
            typeof compareAtRaw === "string" && compareAtRaw.length > 0
                ? parseInt(compareAtRaw, 10)
                : null,
        stock_quantity:
            stockRaw === "null"
                ? null
                : typeof stockRaw === "string" && stockRaw.length > 0
                    ? parseInt(stockRaw, 10)
                    : 0,
        options,
    });
    if (!parsed.success) {
        return {ok: false, error: parsed.error.issues[0]?.message ?? "Paramètres invalides"};
    }

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;
    if (!auth.organizationId) {
        return { ok: false, error: "Organisation introuvable" };
    }

    // Feature gate : variantes multiples réservées au plan Pro.
    // La 1ère variante est toujours autorisée (sinon impossible de publier).
    const gate = await canAddVariantToProduct({
        orgId: auth.organizationId,
        productId: parsed.data.product_id,
    });
    if (!gate.ok) {
        return { ok: false, error: gate.reason };
    }

    const supabase = await createClient();

    // Récupère les dimensions ET le kind du produit
    const { data: product2 } = await supabase
        .from("products")
        .select("variant_dimensions, kind")
        .eq("id", parsed.data.product_id)
        .maybeSingle();
    if (!product2) return { ok: false, error: "Produit introuvable" };

    const expectedDims = product2.variant_dimensions ?? [];
    const providedKeys = Object.keys(parsed.data.options ?? {});
    const isGiftCard = product2.kind === "gift_card";

    if (isGiftCard) {
        // Pour gift_card : on attend obligatoirement la clé "Valeur"
        if (!providedKeys.includes("Valeur")) {
            return {
                ok: false,
                error: "La valeur du bon cadeau est requise (ex: \"25 €\")",
            };
        }
        // On ignore les autres clés silencieusement
    } else {
        // Comportement physical existant
        if (expectedDims.length === 0 && providedKeys.length > 0) {
            return {
                ok: false,
                error: "Ce produit n'a pas de dimensions de variation. Configure-les d'abord dans l'onglet info.",
            };
        }
        if (expectedDims.length > 0) {
            const missing = expectedDims.filter((d) => !providedKeys.includes(d));
            const extra = providedKeys.filter((k) => !expectedDims.includes(k));
            if (missing.length > 0) {
                return { ok: false, error: `Options manquantes : ${missing.join(", ")}` };
            }
            if (extra.length > 0) {
                return { ok: false, error: `Options inconnues : ${extra.join(", ")}` };
            }
        }
    }

    // Display order = max + 10 (pour permettre des insertions au milieu)
    const {data: existing} = await supabase
        .from("product_variants")
        .select("display_order")
        .eq("product_id", parsed.data.product_id)
        .order("display_order", {ascending: false})
        .limit(1);
    const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 10 : 0;

    const {data, error} = await supabase
        .from("product_variants")
        .insert({
            product_id: parsed.data.product_id,
            sku: parsed.data.sku,
            price_cents: parsed.data.price_cents,
            compare_at_price_cents: parsed.data.compare_at_price_cents ?? null,
            stock_quantity:
                parsed.data.stock_quantity === undefined
                    ? 0
                    : parsed.data.stock_quantity,
            options: parsed.data.options ?? {},
            display_order: nextOrder,
            is_active: true,
        })
        .select("id")
        .single();

    if (error) {
        console.error("addVariant failed:", error);
        return {ok: false, error: humanizeVariantError(error.message)};
    }

    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    revalidatePath(`/magasins/[slug]/boutique/[product-slug]`, "page");

    return {ok: true, data: {variant_id: data.id}};
}

// =============================================================================
// 2. Update d'une variante (prix, stock, SKU, etc.)
// =============================================================================

const UpdateVariantSchema = z.object({
    variant_id: z.string().uuid(),
    sku: z.string().min(1).max(64).optional(),
    price_cents: z.number().int().positive().max(10_000_000).optional(),
    compare_at_price_cents: z.number().int().positive().max(10_000_000).nullable().optional(),
    stock_quantity: z.number().int().min(0).nullable().optional(),
    is_active: z.boolean().optional(),
});

export async function updateVariantAction(
    formData: FormData
): Promise<ActionResult> {
    const variantId = formData.get("variant_id");
    if (typeof variantId !== "string") {
        return {ok: false, error: "Variant ID manquant"};
    }

    // Patch typé : Supabase JS exige un type précis, pas Record<string, unknown>
    type VariantPatch = {
        sku?: string;
        price_cents?: number;
        compare_at_price_cents?: number | null;
        stock_quantity?: number | null;
        is_active?: boolean;
    };
    const patch: VariantPatch = {};

    const sku = formData.get("sku");
    if (typeof sku === "string" && sku.length > 0) patch.sku = sku;

    const priceRaw = formData.get("price_cents");
    if (typeof priceRaw === "string" && priceRaw.length > 0) {
        const n = parseInt(priceRaw, 10);
        if (Number.isFinite(n)) patch.price_cents = n;
    }

    const compareAtRaw = formData.get("compare_at_price_cents");
    if (typeof compareAtRaw === "string") {
        if (compareAtRaw === "" || compareAtRaw === "null") {
            patch.compare_at_price_cents = null;
        } else {
            const n = parseInt(compareAtRaw, 10);
            if (Number.isFinite(n)) patch.compare_at_price_cents = n;
        }
    }

    const stockRaw = formData.get("stock_quantity");
    if (typeof stockRaw === "string" && stockRaw.length > 0) {
        if (stockRaw === "null") {
            patch.stock_quantity = null;
        } else {
            const n = parseInt(stockRaw, 10);
            if (Number.isFinite(n)) patch.stock_quantity = n;
        }
    }

    const activeRaw = formData.get("is_active");
    if (typeof activeRaw === "string") {
        patch.is_active = activeRaw === "true";
    }

    if (Object.keys(patch).length === 0) {
        return {ok: false, error: "Rien à modifier"};
    }

    // Validation Zod sur le patch construit
    const parsed = UpdateVariantSchema.safeParse({variant_id: variantId, ...patch});
    if (!parsed.success) {
        return {ok: false, error: parsed.error.issues[0]?.message ?? "Paramètres invalides"};
    }

    const auth = await assertOrgMemberByVariantId(variantId);
    if (!auth.ok) return auth;

    const supabase = await createClient();
    const {error} = await supabase
        .from("product_variants")
        .update(patch)
        .eq("id", variantId);

    if (error) {
        console.error("updateVariant failed:", error);
        return {ok: false, error: humanizeVariantError(error.message)};
    }

    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    revalidatePath(`/magasins/[slug]/boutique/[product-slug]`, "page");

    return {ok: true};
}

// =============================================================================
// 3. Helper rapide : update du stock seul
// =============================================================================

const SetStockSchema = z.object({
    variant_id: z.string().uuid(),
    stock_quantity: z.number().int().min(0).nullable(),
});

export async function setVariantStockAction(
    formData: FormData
): Promise<ActionResult> {
    const stockRaw = formData.get("stock_quantity");

    const parsed = SetStockSchema.safeParse({
        variant_id: formData.get("variant_id"),
        stock_quantity:
            stockRaw === "null"
                ? null
                : typeof stockRaw === "string"
                    ? parseInt(stockRaw, 10)
                    : undefined,
    });
    if (!parsed.success) {
        return {ok: false, error: parsed.error.issues[0]?.message ?? "Paramètres invalides"};
    }

    const auth = await assertOrgMemberByVariantId(parsed.data.variant_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();
    const {error} = await supabase
        .from("product_variants")
        .update({stock_quantity: parsed.data.stock_quantity})
        .eq("id", parsed.data.variant_id);

    if (error) {
        console.error("setVariantStock failed:", error);
        return {ok: false, error: "Erreur de mise à jour du stock."};
    }

    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    return {ok: true};
}

// =============================================================================
// 4. Suppression d'une variante (HARD delete + safeguard "au moins 1 variante")
// =============================================================================

const RemoveVariantSchema = z.object({
    variant_id: z.string().uuid(),
});

export async function removeVariantAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RemoveVariantSchema.safeParse({
        variant_id: formData.get("variant_id"),
    });
    if (!parsed.success) return {ok: false, error: "Paramètres invalides"};

    const auth = await assertOrgMemberByVariantId(parsed.data.variant_id);
    if (!auth.ok) return auth;
    if (!auth.productId) return {ok: false, error: "Variante introuvable"};

    const supabase = await createClient();

    // Safeguard : on refuse de supprimer la dernière variante d'un produit
    const {count} = await supabase
        .from("product_variants")
        .select("id", {count: "exact", head: true})
        .eq("product_id", auth.productId);

    if ((count ?? 0) <= 1) {
        return {
            ok: false,
            error: "Impossible de supprimer la dernière variante. Un produit doit avoir au moins une variante. Ajoute-en une autre avant.",
        };
    }

    const {error} = await supabase
        .from("product_variants")
        .delete()
        .eq("id", parsed.data.variant_id);

    if (error) {
        console.error("removeVariant failed:", error);
        return {ok: false, error: "Erreur lors de la suppression."};
    }

    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    revalidatePath(`/magasins/[slug]/boutique/[product-slug]`, "page");
    return {ok: true};
}

// =============================================================================
// 5. Réordonner les variantes (drag & drop dans le dashboard)
// =============================================================================

const ReorderVariantsSchema = z.object({
    product_id: z.string().uuid(),
    variant_ids: z.array(z.string().uuid()).min(1),
});

export async function reorderVariantsAction(
    formData: FormData
): Promise<ActionResult> {
    const idsRaw = formData.get("variant_ids");
    let variantIds: string[] = [];
    try {
        if (typeof idsRaw === "string") variantIds = JSON.parse(idsRaw);
    } catch {
        return {ok: false, error: "Format invalide"};
    }

    const parsed = ReorderVariantsSchema.safeParse({
        product_id: formData.get("product_id"),
        variant_ids: variantIds,
    });
    if (!parsed.success) return {ok: false, error: "Paramètres invalides"};

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();

    // Vérif que toutes les variantes appartiennent bien au produit (anti-tampering)
    const {data: existingVariants} = await supabase
        .from("product_variants")
        .select("id")
        .eq("product_id", parsed.data.product_id);

    const existingIds = new Set((existingVariants ?? []).map((v) => v.id));
    const allBelong = parsed.data.variant_ids.every((id) => existingIds.has(id));
    if (!allBelong) {
        return {ok: false, error: "Variantes invalides pour ce produit"};
    }

    // Update display_order : on réindexe par 10 (10, 20, 30, ...) pour permettre
    // des insertions futures sans re-sort complet
    const updates = parsed.data.variant_ids.map((id, idx) =>
        supabase
            .from("product_variants")
            .update({display_order: (idx + 1) * 10})
            .eq("id", id)
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
        console.error("reorderVariants failed:", failed.error);
        return {ok: false, error: "Erreur lors du réordonnancement."};
    }

    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    return {ok: true};
}

// =============================================================================
// Helpers
// =============================================================================

function humanizeVariantError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("sku") && lower.includes("déjà utilisé")) {
        return "Ce SKU est déjà utilisé dans ton catalogue. Choisis-en un autre.";
    }
    if (lower.includes("duplicate key") && lower.includes("sku")) {
        return "Ce SKU existe déjà sur ce produit.";
    }
    if (lower.includes("price_cents")) return "Prix invalide (entre 0,01€ et 100 000€).";
    if (lower.includes("stock_quantity")) return "Stock invalide.";
    return msg;
}