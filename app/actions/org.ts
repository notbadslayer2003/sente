"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const FicheSchema = z.object({
    org_id: z.string().uuid(),
    // Champs organizations
    name: z.string().min(2).max(200),
    baseline: z.string().max(120).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    region: z.string().max(100).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    postal_code: z.string().max(20).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    lat: z
        .union([z.coerce.number().min(-90).max(90), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    lng: z
        .union([z.coerce.number().min(-180).max(180), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    contact_email: z
        .union([z.string().email(), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    contact_phone: z.string().max(30).optional().nullable(),
    website: z
        .union([z.string().url(), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    social_facebook: z.string().max(200).optional().nullable(),
    social_instagram: z.string().max(200).optional().nullable(),
});

export type ActionResult =
    | { ok: true }
    | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function updateOrgFicheAction(
    formData: FormData
): Promise<ActionResult> {
    const raw = Object.fromEntries(formData.entries());
    const parsed = FicheSchema.safeParse(raw);

    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const path = issue.path[0]?.toString();
            if (path) fieldErrors[path] = issue.message;
        }
        return { ok: false, error: "Vérifie les champs", fieldErrors };
    }

    const { org_id, ...fields } = parsed.data;

    const supabase = await createClient();

    // RLS vérifie que l'utilisateur est owner/admin de l'org via la policy.
    const { error } = await supabase
        .from("organizations")
        .update(fields)
        .eq("id", org_id);

    if (error) {
        console.error("updateOrgFiche failed:", error);
        return { ok: false, error: "Impossible de sauvegarder. Réessaie." };
    }

    // Revalide la fiche publique + le dashboard
    revalidatePath("/dashboard/[slug]", "page");
    revalidatePath("/lieux/[slug]", "page");
    revalidatePath("/magasins/[slug]", "page");

    return { ok: true };
}