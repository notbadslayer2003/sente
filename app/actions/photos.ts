"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadToR2, deleteFromR2, generateR2Key } from "@/lib/storage/r2";
import { validateImageMagicBytes } from "@/lib/utils/image-validate";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 Mo (limite Vercel Server Action)

const UploadCoverSchema = z.object({
    org_id: z.string().uuid(),
});

export async function uploadOrgCoverAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = UploadCoverSchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const file = formData.get("file");
    if (!(file instanceof File)) {
        return { ok: false, error: "Fichier manquant" };
    }
    if (file.size > MAX_FILE_SIZE) {
        return { ok: false, error: "Fichier trop volumineux (max 4 Mo)" };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // L'utilisateur doit être membre de l'org
    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();
    if (!membership) return { ok: false, error: "Accès refusé" };

    // Validation magic bytes (anti spoof MIME)
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateImageMagicBytes(buffer);
    if (!validation.ok) {
        return { ok: false, error: validation.error };
    }

    // Récupère l'ancien cover pour le supprimer après upload réussi
    const { data: org } = await supabase
        .from("organizations")
        .select("cover_image_url")
        .eq("id", parsed.data.org_id)
        .single();
    const oldCoverUrl = org?.cover_image_url;

    // Upload sur R2
    const key = generateR2Key({
        prefix: "orgs",
        orgOrUserId: parsed.data.org_id,
        subPath: "cover",
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

    // Update l'URL en DB
    const { error: dbError } = await supabase
        .from("organizations")
        .update({ cover_image_url: url })
        .eq("id", parsed.data.org_id);

    if (dbError) {
        // Si la DB plante après upload R2, on essaie de nettoyer R2
        console.error("DB update failed after R2 upload:", dbError);
        await deleteFromR2(url).catch(() => null);
        return { ok: false, error: "Erreur d'enregistrement." };
    }

    // Cleanup ancien cover (best effort, on ne fait pas échouer si ça plante)
    if (oldCoverUrl) {
        await deleteFromR2(oldCoverUrl).catch(() => null);
    }

    revalidatePath("/dashboard/[slug]/photos", "page");
    revalidatePath("/dashboard/[slug]", "page");
    revalidatePath("/lieux/[slug]", "page");
    revalidatePath("/magasins/[slug]", "page");

    return { ok: true, data: { url } };
}

const AddGallerySchema = z.object({
    org_id: z.string().uuid(),
});

export async function addOrgGalleryPhotoAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = AddGallerySchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const file = formData.get("file");
    if (!(file instanceof File)) {
        return { ok: false, error: "Fichier manquant" };
    }
    if (file.size > MAX_FILE_SIZE) {
        return { ok: false, error: "Fichier trop volumineux (max 4 Mo)" };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();
    if (!membership) return { ok: false, error: "Accès refusé" };

    // Limite : max 15 photos par org
    const { data: org } = await supabase
        .from("organizations")
        .select("photos")
        .eq("id", parsed.data.org_id)
        .single();
    if (!org) return { ok: false, error: "Organisation introuvable" };
    if ((org.photos?.length ?? 0) >= 15) {
        return { ok: false, error: "Maximum 15 photos atteint." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateImageMagicBytes(buffer);
    if (!validation.ok) return { ok: false, error: validation.error };

    const key = generateR2Key({
        prefix: "orgs",
        orgOrUserId: parsed.data.org_id,
        subPath: "gallery",
        extension: validation.extension,
    });

    let url: string;
    try {
        const result = await uploadToR2(key, buffer, validation.mimeType);
        url = result.url;
    } catch (err) {
        console.error("R2 upload failed:", err);
        return { ok: false, error: "Erreur d'upload." };
    }

    const newPhotos = [...(org.photos ?? []), url];
    const { error: dbError } = await supabase
        .from("organizations")
        .update({ photos: newPhotos })
        .eq("id", parsed.data.org_id);

    if (dbError) {
        console.error("DB update failed after R2 upload:", dbError);
        await deleteFromR2(url).catch(() => null);
        return { ok: false, error: "Erreur d'enregistrement." };
    }

    revalidatePath("/dashboard/[slug]/photos", "page");
    revalidatePath("/lieux/[slug]", "page");
    revalidatePath("/magasins/[slug]", "page");

    return { ok: true, data: { url } };
}

const RemoveGallerySchema = z.object({
    org_id: z.string().uuid(),
    photo_url: z.string().url(),
});

export async function removeOrgGalleryPhotoAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RemoveGallerySchema.safeParse({
        org_id: formData.get("org_id"),
        photo_url: formData.get("photo_url"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();
    if (!membership) return { ok: false, error: "Accès refusé" };

    const { data: org } = await supabase
        .from("organizations")
        .select("photos")
        .eq("id", parsed.data.org_id)
        .single();
    if (!org) return { ok: false, error: "Organisation introuvable" };

    const newPhotos = (org.photos ?? []).filter(
        (u) => u !== parsed.data.photo_url
    );
    if (newPhotos.length === (org.photos?.length ?? 0)) {
        return { ok: false, error: "Photo introuvable dans la galerie." };
    }

    const { error: dbError } = await supabase
        .from("organizations")
        .update({ photos: newPhotos })
        .eq("id", parsed.data.org_id);

    if (dbError) {
        console.error("DB update failed:", dbError);
        return { ok: false, error: "Erreur lors du retrait." };
    }

    // Suppression R2 best-effort
    await deleteFromR2(parsed.data.photo_url).catch(() => null);

    revalidatePath("/dashboard/[slug]/photos", "page");
    revalidatePath("/lieux/[slug]", "page");
    revalidatePath("/magasins/[slug]", "page");

    return { ok: true };
}