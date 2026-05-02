"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const PosteSchema = z.object({
    etang_id: z.string().uuid(),
    numero: z
        .string()
        .min(1, "Numéro requis")
        .max(20, "Numéro trop long"),
    label: z
        .string()
        .max(100)
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
    description: z
        .string()
        .max(500)
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
    active: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

const PosteUpdateSchema = PosteSchema.extend({
    id: z.string().uuid(),
});

const PosteIdSchema = z.object({
    id: z.string().uuid(),
    etang_id: z.string().uuid(),
});

export async function addPosteAction(
    formData: FormData
): Promise<ActionResult> {
    const raw = {
        etang_id: formData.get("etang_id"),
        numero: formData.get("numero"),
        label: formData.get("label") || undefined,
        description: formData.get("description") || undefined,
        active: formData.get("active"),
    };
    const parsed = PosteSchema.safeParse(raw);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("postes").insert(parsed.data);

    if (error) {
        if (error.code === "23505") {
            return { ok: false, error: "Ce numéro de poste existe déjà." };
        }
        console.error("addPoste failed:", error);
        return { ok: false, error: "Impossible de créer le poste." };
    }

    revalidatePath("/dashboard/[slug]/postes", "page");
    revalidatePath("/dashboard/[slug]", "page");
    return { ok: true };
}

export async function updatePosteAction(
    formData: FormData
): Promise<ActionResult> {
    const raw = {
        id: formData.get("id"),
        etang_id: formData.get("etang_id"),
        numero: formData.get("numero"),
        label: formData.get("label") || undefined,
        description: formData.get("description") || undefined,
        active: formData.get("active"),
    };
    const parsed = PosteUpdateSchema.safeParse(raw);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
    }

    const { id, etang_id, ...fields } = parsed.data;
    const supabase = await createClient();
    const { error } = await supabase
        .from("postes")
        .update(fields)
        .eq("id", id)
        .eq("etang_id", etang_id);

    if (error) {
        if (error.code === "23505") {
            return { ok: false, error: "Ce numéro de poste existe déjà." };
        }
        console.error("updatePoste failed:", error);
        return { ok: false, error: "Impossible de modifier le poste." };
    }

    revalidatePath("/dashboard/[slug]/postes", "page");
    revalidatePath("/dashboard/[slug]", "page");
    return { ok: true };
}

export async function deletePosteAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = PosteIdSchema.safeParse({
        id: formData.get("id"),
        etang_id: formData.get("etang_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase
        .from("postes")
        .delete()
        .eq("id", parsed.data.id)
        .eq("etang_id", parsed.data.etang_id);

    if (error) {
        console.error("deletePoste failed:", error);
        return { ok: false, error: "Impossible de supprimer." };
    }

    revalidatePath("/dashboard/[slug]/postes", "page");
    revalidatePath("/dashboard/[slug]", "page");
    return { ok: true };
}

const ToggleAttribuesSchema = z.object({
    org_id: z.string().uuid(),
    enabled: z.preprocess((v) => v === "true" || v === true, z.boolean()),
});

export async function togglePostesAttribuesAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ToggleAttribuesSchema.safeParse({
        org_id: formData.get("org_id"),
        enabled: formData.get("enabled"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase
        .from("etang_details")
        .update({ postes_attribues_actifs: parsed.data.enabled })
        .eq("organization_id", parsed.data.org_id);

    if (error) {
        console.error("togglePostesAttribues failed:", error);
        return { ok: false, error: "Impossible de mettre à jour." };
    }

    revalidatePath("/dashboard/[slug]/postes", "page");
    return { ok: true };
}