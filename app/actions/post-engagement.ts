"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

// ─── Likes ────────────────────────────────────────────────────────────────────

const ToggleLikePostSchema = z.object({
    post_id: z.string().uuid(),
});

/**
 * Toggle un like sur un post. Retourne l'état final (liked: true/false).
 */
export async function togglePostLikeAction(
    formData: FormData
): Promise<ActionResult<{ liked: boolean; likes_count: number }>> {
    const parsed = ToggleLikePostSchema.safeParse({
        post_id: formData.get("post_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // Vérifie l'existence d'un like
    const { data: existing } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("post_id", parsed.data.post_id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (existing) {
        // Unlike
        const { error } = await supabase
            .from("post_likes")
            .delete()
            .eq("post_id", parsed.data.post_id)
            .eq("user_id", user.id);
        if (error) {
            console.error("unlike failed:", error);
            return { ok: false, error: "Erreur." };
        }
    } else {
        // Like
        const { error } = await supabase
            .from("post_likes")
            .insert({
                post_id: parsed.data.post_id,
                user_id: user.id,
            });
        if (error) {
            console.error("like failed:", error);
            return { ok: false, error: "Erreur." };
        }
    }

    // Récupère le nouveau count (le trigger DB l'a déjà mis à jour)
    const { data: post } = await supabase
        .from("posts")
        .select("likes_count")
        .eq("id", parsed.data.post_id)
        .single();

    return {
        ok: true,
        data: {
            liked: !existing,
            likes_count: post?.likes_count ?? 0,
        },
    };
}

const ToggleLikeCommentSchema = z.object({
    comment_id: z.string().uuid(),
});

export async function toggleCommentLikeAction(
    formData: FormData
): Promise<ActionResult<{ liked: boolean; likes_count: number }>> {
    const parsed = ToggleLikeCommentSchema.safeParse({
        comment_id: formData.get("comment_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    const { data: existing } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("comment_id", parsed.data.comment_id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from("comment_likes")
            .delete()
            .eq("comment_id", parsed.data.comment_id)
            .eq("user_id", user.id);
        if (error) return { ok: false, error: "Erreur." };
    } else {
        const { error } = await supabase
            .from("comment_likes")
            .insert({
                comment_id: parsed.data.comment_id,
                user_id: user.id,
            });
        if (error) return { ok: false, error: "Erreur." };
    }

    const { data: comment } = await supabase
        .from("post_comments")
        .select("likes_count")
        .eq("id", parsed.data.comment_id)
        .single();

    return {
        ok: true,
        data: {
            liked: !existing,
            likes_count: comment?.likes_count ?? 0,
        },
    };
}

// ─── Commentaires ─────────────────────────────────────────────────────────────

const CreateCommentSchema = z.object({
    post_id: z.string().uuid(),
    parent_id: z
        .union([z.string().uuid(), z.literal("")])
        .optional()
        .transform((v) => (v && v.length > 0 ? v : null)),
    content: z
        .string()
        .min(1, "Le commentaire ne peut pas être vide")
        .max(2000, "Maximum 2000 caractères"),
});

export async function createCommentAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = CreateCommentSchema.safeParse({
        post_id: formData.get("post_id"),
        parent_id: formData.get("parent_id") || undefined,
        content: formData.get("content"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Champs invalides",
        };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("create_post_comment", {
        p_post_id: parsed.data.post_id,
        p_parent_id: parsed.data.parent_id,
        p_content: parsed.data.content,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    if (error) {
        console.error("create_post_comment failed:", error);
        return { ok: false, error: humanizeCommentError(error.message) };
    }

    revalidatePath("/post/[id]", "page");
    revalidatePath("/feed");
    return { ok: true };
}

const UpdateCommentSchema = z.object({
    comment_id: z.string().uuid(),
    content: z
        .string()
        .min(1, "Le commentaire ne peut pas être vide")
        .max(2000, "Maximum 2000 caractères"),
});

export async function updateCommentAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = UpdateCommentSchema.safeParse({
        comment_id: formData.get("comment_id"),
        content: formData.get("content"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Champs invalides",
        };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("update_post_comment", {
        p_comment_id: parsed.data.comment_id,
        p_content: parsed.data.content,
    });

    if (error) {
        console.error("update_post_comment failed:", error);
        return { ok: false, error: humanizeCommentError(error.message) };
    }

    revalidatePath("/post/[id]", "page");
    return { ok: true };
}

const DeleteCommentSchema = z.object({
    comment_id: z.string().uuid(),
});

export async function deleteCommentAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = DeleteCommentSchema.safeParse({
        comment_id: formData.get("comment_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // Soft delete : seul l'auteur peut supprimer (RLS l'autorise)
    const { error } = await supabase
        .from("post_comments")
        .update({
            deleted_at: new Date().toISOString(),
            status: "removed",
        })
        .eq("id", parsed.data.comment_id)
        .eq("author_user_id", user.id);

    if (error) {
        console.error("deleteComment failed:", error);
        return { ok: false, error: "Suppression refusée." };
    }

    revalidatePath("/post/[id]", "page");
    return { ok: true };
}

const HideCommentSchema = z.object({
    comment_id: z.string().uuid(),
});

export async function hideCommentAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = HideCommentSchema.safeParse({
        comment_id: formData.get("comment_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("hide_post_comment", {
        p_comment_id: parsed.data.comment_id,
    });

    if (error) {
        console.error("hide_post_comment failed:", error);
        return { ok: false, error: humanizeCommentError(error.message) };
    }

    revalidatePath("/post/[id]", "page");
    return { ok: true };
}

function humanizeCommentError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("commentaire invalide")) return "Le commentaire est trop long ou vide.";
    if (lower.includes("post introuvable")) return "Post introuvable ou supprimé.";
    if (lower.includes("commentaire parent")) return "Commentaire parent introuvable.";
    if (lower.includes("maximum 2 niveaux")) return "Tu ne peux répondre qu'à un commentaire racine.";
    if (lower.includes("non autorisé")) return "Action non autorisée.";
    if (lower.includes("auteur du post")) return "Seul l'auteur du post peut masquer un commentaire.";
    return msg;
}