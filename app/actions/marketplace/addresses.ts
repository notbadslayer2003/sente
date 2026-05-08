"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// =============================================================================
// Server Actions : marketplace_addresses
// =============================================================================
// Note schéma DB : line2, phone, label sont required (pas nullables) → on
// utilise "" comme valeur par défaut quand non fournis.
// Pas de deleted_at sur cette table → vraie suppression DELETE.
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const addressInputSchema = z.object({
    full_name: z.string().min(2).max(100),
    line1: z.string().min(2).max(200),
    line2: z.string().max(200).optional().default(""),
    postal_code: z.string().min(4).max(10),
    city: z.string().min(2).max(100),
    country: z.enum(["BE", "FR"]),
    phone: z.string().max(30).optional().default(""),
    label: z.string().max(50).optional().default(""),
    is_default: z.boolean().optional().default(false),
});

async function requireUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("UNAUTHENTICATED");
    return { supabase, user };
}

// =============================================================================
// Action : createMyAddress
// =============================================================================

export async function createMyAddress(
    input: z.infer<typeof addressInputSchema>
): Promise<ActionResult<{ id: string }>> {
    const parsed = addressInputSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();

    // Si c'est la 1ère adresse, force is_default à true
    const { count } = await supabase
        .from("marketplace_addresses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

    const isDefault = (count ?? 0) === 0 ? true : parsed.data.is_default;

    if (isDefault) {
        await supabase
            .from("marketplace_addresses")
            .update({ is_default: false })
            .eq("user_id", user.id);
    }

    const { data, error } = await supabase
        .from("marketplace_addresses")
        .insert({
            user_id: user.id,
            full_name: parsed.data.full_name,
            line1: parsed.data.line1,
            line2: parsed.data.line2,
            postal_code: parsed.data.postal_code,
            city: parsed.data.city,
            country: parsed.data.country,
            phone: parsed.data.phone,
            label: parsed.data.label,
            is_default: isDefault,
        })
        .select("id")
        .single();

    if (error) {
        return { ok: false, error: { code: "DB_INSERT_FAILED", message: error.message } };
    }

    revalidatePath("/profil/marketplace");
    return { ok: true, data: { id: data.id } };
}

// =============================================================================
// Action : updateMyAddress
// =============================================================================

export async function updateMyAddress(input: {
    id: string;
    fields: z.infer<typeof addressInputSchema>;
}): Promise<ActionResult> {
    const parsed = addressInputSchema.safeParse(input.fields);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }
    if (!input.id || typeof input.id !== "string") {
        return { ok: false, error: { code: "INVALID_INPUT", message: "id manquant" } };
    }

    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();

    if (parsed.data.is_default) {
        await supabase
            .from("marketplace_addresses")
            .update({ is_default: false })
            .eq("user_id", user.id)
            .neq("id", input.id);
    }

    const { error } = await supabase
        .from("marketplace_addresses")
        .update({
            full_name: parsed.data.full_name,
            line1: parsed.data.line1,
            line2: parsed.data.line2,
            postal_code: parsed.data.postal_code,
            city: parsed.data.city,
            country: parsed.data.country,
            phone: parsed.data.phone,
            label: parsed.data.label,
            is_default: parsed.data.is_default,
        })
        .eq("id", input.id)
        .eq("user_id", user.id);

    if (error) {
        return { ok: false, error: { code: "DB_UPDATE_FAILED", message: error.message } };
    }

    revalidatePath("/profil/marketplace");
    return { ok: true, data: undefined };
}

// =============================================================================
// Action : deleteMyAddress (suppression DEFINITIVE — pas de soft delete)
// =============================================================================

export async function deleteMyAddress(input: {
    id: string;
}): Promise<ActionResult> {
    let user;
    try {
        ({ user } = await requireUser());
    } catch {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const supabase = await createClient();
    const { error } = await supabase
        .from("marketplace_addresses")
        .delete()
        .eq("id", input.id)
        .eq("user_id", user.id);

    if (error) {
        return { ok: false, error: { code: "DB_DELETE_FAILED", message: error.message } };
    }

    revalidatePath("/profil/marketplace");
    return { ok: true, data: undefined };
}