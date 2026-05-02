"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
    detectImageMime,
    isAllowedImageMime,
} from "@/lib/utils/image-validate";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 Mo (limite Vercel Server Action)

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const UploadCoverSchema = z.object({
    org_id: z.string().uuid(),
});

export async function uploadOrgCoverAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = UploadCoverSchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) {
        return { ok: false, error: "Paramètres invalides" };
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
        return { ok: false, error: "Aucun fichier" };
    }

    if (file.size > MAX_FILE_SIZE) {
        return { ok: false, error: "Fichier trop lourd (4 Mo max)" };
    }

    // Magic bytes
    const buffer = await file.arrayBuffer();
    const detectedMime = detectImageMime(buffer);
    if (!isAllowedImageMime(detectedMime)) {
        return { ok: false, error: "Format non supporté (JPEG, PNG, WebP uniquement)" };
    }

    const supabase = await createClient();

    // Vérification membership (RLS double check côté serveur)
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

    // Path : {org_id}/cover-{timestamp}.{ext}
    // Le timestamp casse le cache CDN entre uploads successifs.
    const ext = mimeToExt(detectedMime!);
    const path = `${parsed.data.org_id}/cover-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from("org-photos")
        .upload(path, buffer, {
            contentType: detectedMime!,
            upsert: false,
            cacheControl: "31536000", // 1 an, casse via le timestamp dans le path
        });
    if (uploadError) {
        console.error("upload cover failed:", uploadError);
        return { ok: false, error: "Échec de l'upload" };
    }

    const {
        data: { publicUrl },
    } = supabase.storage.from("org-photos").getPublicUrl(path);

    // Update org.cover_image_url + suppression de l'ancienne cover si existante
    const { data: oldOrg } = await supabase
        .from("organizations")
        .select("cover_image_url")
        .eq("id", parsed.data.org_id)
        .single();

    const { error: updateError } = await supabase
        .from("organizations")
        .update({ cover_image_url: publicUrl })
        .eq("id", parsed.data.org_id);
    if (updateError) {
        return { ok: false, error: "Photo uploadée mais échec mise à jour" };
    }

    // Best effort : supprimer l'ancienne cover (ne pas bloquer si échec)
    if (oldOrg?.cover_image_url) {
        const oldPath = extractStoragePath(oldOrg.cover_image_url);
        if (oldPath) {
            await supabase.storage.from("org-photos").remove([oldPath]).catch(() => {});
        }
    }

    revalidatePath("/dashboard/[slug]", "page");
    revalidatePath("/lieux/[slug]", "page");
    revalidatePath("/magasins/[slug]", "page");

    return { ok: true, data: { url: publicUrl } };
}

const AddGalleryPhotoSchema = z.object({
    org_id: z.string().uuid(),
});

export async function addOrgGalleryPhotoAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = AddGalleryPhotoSchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Aucun fichier" };
    if (file.size > MAX_FILE_SIZE) {
        return { ok: false, error: "Fichier trop lourd (4 Mo max)" };
    }

    const buffer = await file.arrayBuffer();
    const detectedMime = detectImageMime(buffer);
    if (!isAllowedImageMime(detectedMime)) {
        return { ok: false, error: "Format non supporté" };
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

    // Vérif limite 15 photos
    const { data: org } = await supabase
        .from("organizations")
        .select("photos")
        .eq("id", parsed.data.org_id)
        .single();
    if (!org) return { ok: false, error: "Organisation introuvable" };
    const currentPhotos = org.photos ?? [];
    if (currentPhotos.length >= 15) {
        return { ok: false, error: "Limite de 15 photos atteinte" };
    }

    const ext = mimeToExt(detectedMime!);
    const path = `${parsed.data.org_id}/gallery/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from("org-photos")
        .upload(path, buffer, {
            contentType: detectedMime!,
            upsert: false,
            cacheControl: "31536000",
        });
    if (uploadError) return { ok: false, error: "Échec de l'upload" };

    const {
        data: { publicUrl },
    } = supabase.storage.from("org-photos").getPublicUrl(path);

    const { error: updateError } = await supabase
        .from("organizations")
        .update({ photos: [...currentPhotos, publicUrl] })
        .eq("id", parsed.data.org_id);
    if (updateError) return { ok: false, error: "Photo uploadée mais échec mise à jour" };

    revalidatePath("/dashboard/[slug]", "page");
    revalidatePath("/lieux/[slug]", "page");
    revalidatePath("/magasins/[slug]", "page");

    return { ok: true, data: { url: publicUrl } };
}

const RemoveGalleryPhotoSchema = z.object({
    org_id: z.string().uuid(),
    photo_url: z.string().url(),
});

export async function removeOrgGalleryPhotoAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RemoveGalleryPhotoSchema.safeParse({
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

    const updated = (org.photos ?? []).filter((p: string) => p !== parsed.data.photo_url);

    const { error: updateError } = await supabase
        .from("organizations")
        .update({ photos: updated })
        .eq("id", parsed.data.org_id);
    if (updateError) return { ok: false, error: "Échec mise à jour" };

    // Best effort : supprimer du storage
    const path = extractStoragePath(parsed.data.photo_url);
    if (path) {
        await supabase.storage.from("org-photos").remove([path]).catch(() => {});
    }

    revalidatePath("/dashboard/[slug]", "page");
    return { ok: true };
}

// Helpers
function mimeToExt(mime: string): string {
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return "bin";
}

function extractStoragePath(publicUrl: string): string | null {
    const match = publicUrl.match(/\/storage\/v1\/object\/public\/org-photos\/(.+)$/);
    return match?.[1] ?? null;
}