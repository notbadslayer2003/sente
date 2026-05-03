"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { uploadToR2, generateR2Key } from "@/lib/storage/r2";
import { validateImageMagicBytes } from "@/lib/utils/image-validate";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const MAX_FILE_SIZE = 4 * 1024 * 1024;

const Schema = z.object({
    organization_id: z.string().uuid(),
});

export async function uploadEventCoverAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = Schema.safeParse({
        organization_id: formData.get("organization_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Fichier manquant" };
    if (file.size > MAX_FILE_SIZE) return { ok: false, error: "Fichier trop volumineux (max 4 Mo)" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.organization_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return { ok: false, error: "Accès refusé" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateImageMagicBytes(buffer);
    if (!validation.ok) return { ok: false, error: validation.error };

    const key = generateR2Key({
        prefix: "orgs",
        orgOrUserId: parsed.data.organization_id,
        subPath: "event-cover",
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