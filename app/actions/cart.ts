"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zUuid } from "@/lib/utils/zod-helpers";
import {CartGroup, getMyCartGroups} from "@/lib/dal/cart";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

// =============================================================================
// 1. Add to cart
// =============================================================================

const AddToCartSchema = z.object({
    product_variant_id: zUuid,
    quantity: z
        .number()
        .int()
        .min(1, "Quantité minimum 1")
        .max(99, "Quantité maximum 99"),
});

export async function addToCartAction(
    formData: FormData
): Promise<ActionResult<{ cart_item_id: string }>> {
    const qtyRaw = formData.get("quantity");
    const parsed = AddToCartSchema.safeParse({
        product_variant_id: formData.get("product_variant_id"),
        quantity:
            typeof qtyRaw === "string" && qtyRaw.length > 0
                ? parseInt(qtyRaw, 10)
                : 1,
    });

    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Paramètres invalides",
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return {
            ok: false,
            error: "Connecte-toi pour ajouter au panier",
        };
    }

    const { data, error } = await supabase.rpc("add_to_cart", {
        p_product_variant_id: parsed.data.product_variant_id,
        p_quantity: parsed.data.quantity,
    });

    if (error) {
        console.error("add_to_cart failed:", error);
        return { ok: false, error: humanizeCartError(error.message) };
    }
    if (!data) return { ok: false, error: "Erreur inattendue" };

    revalidatePath("/panier");
    revalidatePath("/magasins/[slug]/boutique/[product-slug]", "page");

    return { ok: true, data: { cart_item_id: data as string } };
}

// =============================================================================
// 2. Update cart item quantity
// =============================================================================

const UpdateQuantitySchema = z.object({
    cart_item_id: zUuid,
    quantity: z.number().int().min(0).max(99),
});

export async function updateCartItemQuantityAction(
    formData: FormData
): Promise<ActionResult> {
    const qtyRaw = formData.get("quantity");
    const parsed = UpdateQuantitySchema.safeParse({
        cart_item_id: formData.get("cart_item_id"),
        quantity:
            typeof qtyRaw === "string" && qtyRaw.length > 0
                ? parseInt(qtyRaw, 10)
                : undefined,
    });

    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Paramètres invalides",
        };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("update_cart_item_quantity", {
        p_cart_item_id: parsed.data.cart_item_id,
        p_quantity: parsed.data.quantity,
    });

    if (error) {
        console.error("update_cart_item_quantity failed:", error);
        return { ok: false, error: humanizeCartError(error.message) };
    }

    revalidatePath("/panier");
    return { ok: true };
}

// =============================================================================
// 3. Remove cart item
// =============================================================================

const RemoveItemSchema = z.object({
    cart_item_id: zUuid,
});

export async function removeCartItemAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RemoveItemSchema.safeParse({
        cart_item_id: formData.get("cart_item_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_cart_item", {
        p_cart_item_id: parsed.data.cart_item_id,
    });

    if (error) {
        console.error("remove_cart_item failed:", error);
        return { ok: false, error: humanizeCartError(error.message) };
    }

    revalidatePath("/panier");
    return { ok: true };
}

// =============================================================================
// 4. Clear cart (un magasin entier)
// =============================================================================

const ClearCartSchema = z.object({
    cart_id: zUuid,
});

export async function clearCartAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ClearCartSchema.safeParse({
        cart_id: formData.get("cart_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("clear_cart", {
        p_cart_id: parsed.data.cart_id,
    });

    if (error) {
        console.error("clear_cart failed:", error);
        return { ok: false, error: humanizeCartError(error.message) };
    }

    revalidatePath("/panier");
    return { ok: true };
}

// =============================================================================
// Helper : humanise les erreurs SQL
// =============================================================================

function humanizeCartError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("connecte-toi")) return "Connecte-toi pour utiliser le panier.";
    if (lower.includes("authentification requise")) return "Session expirée, reconnecte-toi.";
    if (lower.includes("produit indisponible")) return "Ce produit n'est plus disponible.";
    if (lower.includes("stock insuffisant")) return msg.replace(/^\w+ exception: /i, "");
    if (lower.includes("quantité invalide")) return "Quantité invalide (1-99).";
    if (lower.includes("maximum 99")) return "Maximum 99 unités par variante.";
    if (lower.includes("introuvable")) return "Élément introuvable.";
    return msg;
}

export async function getCartGroupsAction(): Promise<CartGroup[]> {
    return getMyCartGroups();
}