"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { uploadToR2, generateR2Key } from "@/lib/storage/r2";
import { validateImageMagicBytes } from "@/lib/utils/image-validate";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const MAX_FILE_SIZE = 4 * 1024 * 1024;

const UploadSchema = z.object({});

/**
 * Upload une photo dans R2 sous la clé "posts/{user_id}/{ts}-{rand}.jpg"
 * et retourne juste l'URL. Le post lui-même n'existe pas encore en DB
 * (c'est create_post qui le crée avec la liste de photos).
 */
export async function uploadPostPhotoAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateImageMagicBytes(buffer);
    if (!validation.ok) return { ok: false, error: validation.error };

    const key = generateR2Key({
        prefix: "posts",
        orgOrUserId: user.id,
        extension: validation.extension,
    });

    try {
        const result = await uploadToR2(key, buffer, validation.mimeType);
        return { ok: true, data: { url: result.url } };
    } catch (err) {
        console.error("R2 upload failed:", err);
        return { ok: false, error: "Erreur d'upload." };
    }
}