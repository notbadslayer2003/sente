"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadToR2, deleteFromR2, generateR2Key } from "@/lib/storage/r2";
import { validateImageMagicBytes } from "@/lib/utils/image-validate";
import { assertOrgMemberByProductId } from "@/lib/auth/assert-org-member";
import {canAddProductPhoto} from "@/lib/dal/feature-gate";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 Mo (limite Vercel Server Action)
const MAX_PHOTOS_PER_PRODUCT = 8;

// =============================================================================
// 1. Upload d'une photo produit
// =============================================================================

const UploadPhotoSchema = z.object({
    product_id: z.string().uuid(),
});

export async function uploadProductPhotoAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = UploadPhotoSchema.safeParse({
        product_id: formData.get("product_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const file = formData.get("file");
    if (!(file instanceof File)) {
        return { ok: false, error: "Fichier manquant" };
    }
    if (file.size > MAX_FILE_SIZE) {
        return { ok: false, error: "Fichier trop volumineux (max 4 Mo)" };
    }

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;
    if (!auth.organizationId) return { ok: false, error: "Produit introuvable" };

    // Feature gate : limite de photos par produit selon plan
    const gate = await canAddProductPhoto({
        orgId: auth.organizationId,
        productId: parsed.data.product_id,
    });
    if (!gate.ok) {
        return { ok: false, error: gate.reason };
    }

    const supabase = await createClient();

    // Vérifie le compte de photos actuel (max 8 — limite globale en plus du plan)
    const { data: product } = await supabase
        .from("products")
        .select("photos")
        .eq("id", parsed.data.product_id)
        .maybeSingle();

    if (!product) return { ok: false, error: "Produit introuvable" };

    const currentPhotos = product.photos ?? [];
    if (currentPhotos.length >= MAX_PHOTOS_PER_PRODUCT) {
        return {
            ok: false,
            error: `Limite de ${MAX_PHOTOS_PER_PRODUCT} photos atteinte. Supprime-en une avant d'ajouter.`,
        };
    }

    // Validation magic bytes (anti spoof MIME, anti SVG)
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateImageMagicBytes(buffer);
    if (!validation.ok) {
        return { ok: false, error: validation.error };
    }

    // Upload R2 sous orgs/{org_id}/products/{product_id}/{rand}.jpg
    const key = generateR2Key({
        prefix: "orgs",
        orgOrUserId: auth.organizationId,
        subPath: `products/${parsed.data.product_id}`,
        extension: validation.extension,
    });

    let url: string;
    try {
        const result = await uploadToR2(key, buffer, validation.mimeType);
        url = result.url;
    } catch (err) {
        console.error("R2 upload failed:", err);
        return { ok: false, error: "Erreur d'upload, réessaie." };
    }

    // Append à l'array photos
    const newPhotos = [...currentPhotos, url];
    const { error: dbError } = await supabase
        .from("products")
        .update({ photos: newPhotos })
        .eq("id", parsed.data.product_id);

    if (dbError) {
        // Rollback R2 best-effort si la DB plante
        console.error("DB update failed after R2 upload:", dbError);
        await deleteFromR2(url).catch(() => null);
        return { ok: false, error: "Erreur d'enregistrement." };
    }

    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    revalidatePath(`/magasins/[slug]/boutique/[product-slug]`, "page");

    return { ok: true, data: { url } };
}

// =============================================================================
// 2. Suppression d'une photo
// =============================================================================

const RemovePhotoSchema = z.object({
    product_id: z.string().uuid(),
    photo_url: z.string().url(),
});

export async function removeProductPhotoAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RemovePhotoSchema.safeParse({
        product_id: formData.get("product_id"),
        photo_url: formData.get("photo_url"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();
    const { data: product } = await supabase
        .from("products")
        .select("photos")
        .eq("id", parsed.data.product_id)
        .maybeSingle();
    if (!product) return { ok: false, error: "Produit introuvable" };

    const currentPhotos = product.photos ?? [];
    const newPhotos = currentPhotos.filter((u) => u !== parsed.data.photo_url);

    if (newPhotos.length === currentPhotos.length) {
        return { ok: false, error: "Photo introuvable dans ce produit." };
    }

    const { error: dbError } = await supabase
        .from("products")
        .update({ photos: newPhotos })
        .eq("id", parsed.data.product_id);

    if (dbError) {
        console.error("DB update failed:", dbError);
        return { ok: false, error: "Erreur lors du retrait." };
    }

    // Cleanup R2 best-effort (on ne fait pas planter si ça échoue)
    await deleteFromR2(parsed.data.photo_url).catch(() => null);

    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    revalidatePath(`/magasins/[slug]/boutique/[product-slug]`, "page");

    return { ok: true };
}

// =============================================================================
// 3. Réordonner les photos (drag & drop)
// =============================================================================

const ReorderPhotosSchema = z.object({
    product_id: z.string().uuid(),
    photo_urls: z.array(z.string().url()).min(1).max(MAX_PHOTOS_PER_PRODUCT),
});

export async function reorderProductPhotosAction(
    formData: FormData
): Promise<ActionResult> {
    const urlsRaw = formData.get("photo_urls");
    let photoUrls: string[] = [];
    try {
        if (typeof urlsRaw === "string") photoUrls = JSON.parse(urlsRaw);
    } catch {
        return { ok: false, error: "Format invalide" };
    }

    const parsed = ReorderPhotosSchema.safeParse({
        product_id: formData.get("product_id"),
        photo_urls: photoUrls,
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();
    const { data: product } = await supabase
        .from("products")
        .select("photos")
        .eq("id", parsed.data.product_id)
        .maybeSingle();
    if (!product) return { ok: false, error: "Produit introuvable" };

    // Anti-tampering : on vérifie que les URLs envoyées sont exactement les mêmes
    // que celles déjà en DB (juste réordonnées). Pas d'ajout/suppression furtif.
    const currentSet = new Set(product.photos ?? []);
    const newSet = new Set(parsed.data.photo_urls);

    if (currentSet.size !== newSet.size) {
        return { ok: false, error: "Listes incohérentes (taille différente)" };
    }
    for (const url of parsed.data.photo_urls) {
        if (!currentSet.has(url)) {
            return { ok: false, error: "Une URL ne correspond pas aux photos existantes" };
        }
    }

    const { error } = await supabase
        .from("products")
        .update({ photos: parsed.data.photo_urls })
        .eq("id", parsed.data.product_id);

    if (error) {
        console.error("reorderPhotos failed:", error);
        return { ok: false, error: "Erreur lors du réordonnancement." };
    }

    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    revalidatePath(`/magasins/[slug]/boutique/[product-slug]`, "page");

    return { ok: true };
}

// =============================================================================
// 4. Définir la photo principale (= mettre en première position)
// =============================================================================

const SetPrimaryPhotoSchema = z.object({
    product_id: z.string().uuid(),
    photo_url: z.string().url(),
});

export async function setPrimaryProductPhotoAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = SetPrimaryPhotoSchema.safeParse({
        product_id: formData.get("product_id"),
        photo_url: formData.get("photo_url"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const auth = await assertOrgMemberByProductId(parsed.data.product_id);
    if (!auth.ok) return auth;

    const supabase = await createClient();
    const { data: product } = await supabase
        .from("products")
        .select("photos")
        .eq("id", parsed.data.product_id)
        .maybeSingle();
    if (!product) return { ok: false, error: "Produit introuvable" };

    const currentPhotos = product.photos ?? [];
    if (!currentPhotos.includes(parsed.data.photo_url)) {
        return { ok: false, error: "Photo introuvable dans ce produit." };
    }

    // Reorder : la photo cible passe en première position, les autres conservent leur ordre
    const newPhotos = [
        parsed.data.photo_url,
        ...currentPhotos.filter((u) => u !== parsed.data.photo_url),
    ];

    const { error } = await supabase
        .from("products")
        .update({ photos: newPhotos })
        .eq("id", parsed.data.product_id);

    if (error) {
        console.error("setPrimaryPhoto failed:", error);
        return { ok: false, error: "Erreur lors du changement de photo principale." };
    }

    revalidatePath(`/dashboard/[slug]/produits/[id]`, "page");
    revalidatePath(`/magasins/[slug]/boutique/[product-slug]`, "page");
    revalidatePath(`/magasins/[slug]/boutique`, "page"); // la card change aussi

    return { ok: true };
}