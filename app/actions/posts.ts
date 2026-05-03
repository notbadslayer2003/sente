"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const EspeceEnum = z.enum([
    "carpe",
    "silure",
    "brochet",
    "sandre",
    "perche",
    "truite",
    "black_bass",
    "gardon",
    "tanche",
    "esturgeon",
    "salmonide",
    "carnassier",
    "blanc",
]);

const CreatePostSchema = z.object({
    // Auteur : soit en tant que user (user_id implicite), soit en tant qu'org (org_id)
    author_org_id: z
        .union([z.string().uuid(), z.literal("")])
        .optional()
        .transform((v) => (v && v.length > 0 ? v : null)),
    content: z
        .string()
        .min(1, "Le post ne peut pas être vide")
        .max(4000, "Maximum 4000 caractères")
        .transform((v) => v.trim()),
    photos: z.array(z.string().url()).max(5, "Max 5 photos"),
    espece: z
        .union([EspeceEnum, z.literal("")])
        .optional()
        .transform((v) => (v && v !== "" ? v : null)),
    weight_kg: z.coerce
        .number()
        .min(0)
        .max(999.99)
        .optional()
        .nullable(),
    matos: z
        .string()
        .max(100)
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
    mentioned_org_ids: z.array(z.string().uuid()).max(5),
});

export async function createPostAction(
    formData: FormData
): Promise<ActionResult<{ post_id: string }>> {
    const photos = formData.getAll("photos").map(String).filter(Boolean);
    const mentionedOrgIds = formData
        .getAll("mentioned_org_ids")
        .map(String)
        .filter(Boolean);

    const weightRaw = formData.get("weight_kg");
    const weight =
        weightRaw && weightRaw !== ""
            ? parseFloat(String(weightRaw))
            : null;

    const raw = {
        author_org_id: formData.get("author_org_id") || undefined,
        content: formData.get("content"),
        photos,
        espece: formData.get("espece") || undefined,
        weight_kg: weight,
        matos: formData.get("matos") || undefined,
        mentioned_org_ids: mentionedOrgIds,
    };

    const parsed = CreatePostSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Champs invalides",
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // RPC : crée le post + mentions atomiquement
    const { data, error } = await supabase
        .rpc("create_post", {
            p_author_user_id: parsed.data.author_org_id ? null : user.id,
            p_author_org_id: parsed.data.author_org_id,
            p_content: parsed.data.content,
            p_photos: parsed.data.photos,
            p_espece: parsed.data.espece,
            p_weight_kg: parsed.data.weight_kg,
            p_matos: parsed.data.matos,
            p_mentioned_org_ids: parsed.data.mentioned_org_ids,
        })
        .single();

    if (error) {
        console.error("create_post failed:", error);
        return { ok: false, error: humanizePostError(error.message) };
    }
    if (!data) return { ok: false, error: "Erreur inattendue" };

    revalidatePath("/feed");
    if (parsed.data.author_org_id) {
        revalidatePath("/dashboard/[slug]/posts", "page");
    }

    return { ok: true, data: { post_id: data.post_id } };
}

const DeletePostSchema = z.object({
    post_id: z.string().uuid(),
});

export async function deletePostAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = DeletePostSchema.safeParse({
        post_id: formData.get("post_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // RLS : seul l'auteur (user) ou un membre de l'org auteur peut delete
    const { error } = await supabase
        .from("posts")
        .update({ deleted_at: new Date().toISOString(), status: "removed" })
        .eq("id", parsed.data.post_id);

    if (error) {
        console.error("deletePost failed:", error);
        return { ok: false, error: "Suppression refusée." };
    }

    revalidatePath("/feed");
    revalidatePath("/post/[id]", "page");
    return { ok: true };
}

function humanizePostError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("contenu invalide")) return "Le post est trop long ou vide.";
    if (lower.includes("maximum 5 photos")) return "Maximum 5 photos par post.";
    if (lower.includes("maximum 5 mentions")) return "Maximum 5 mentions par post.";
    if (lower.includes("posts pour cette organisation"))
        return "Tu n'es pas membre de cette organisation.";
    if (lower.includes("autre user")) return "Action non autorisée.";
    return msg;
}