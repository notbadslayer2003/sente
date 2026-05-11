"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slug";
import { revalidatePath } from "next/cache";

// =============================================================================
// Création d'une nouvelle organisation par un user connecté
// =============================================================================
// L'org est créée en status 'draft' (default RPC). Le user complète ensuite
// les détails depuis son dashboard, puis soumet pour review.
// Limite côté DB : 5 orgs par owner (cf RPC create_organization_for_owner).
// =============================================================================

const createMyOrganizationSchema = z.object({
    orgType: z.enum(["etang", "magasin"]),
    orgName: z.string().trim().min(2, "Nom trop court").max(100, "Nom trop long"),
    orgCountry: z.enum(["BE", "FR"]),
});

export type CreateMyOrganizationResult =
    | { ok: true; slug: string }
    | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function createMyOrganization(
    formData: FormData
): Promise<CreateMyOrganizationResult> {
    const parsed = createMyOrganizationSchema.safeParse({
        orgType: formData.get("orgType"),
        orgName: formData.get("orgName"),
        orgCountry: formData.get("orgCountry"),
    });

    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const path = issue.path[0]?.toString();
            if (path) fieldErrors[path] = issue.message;
        }
        return { ok: false, error: "Vérifie les champs", fieldErrors };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: "Tu dois être connecté." };
    }

    const slug = slugify(parsed.data.orgName);

    const { error: rpcError } = await supabase.rpc(
        "create_organization_for_owner",
        {
            p_org_type: parsed.data.orgType,
            p_name: parsed.data.orgName.trim(),
            p_slug: slug,
            p_country: parsed.data.orgCountry,
        }
    );

    if (rpcError) {
        return { ok: false, error: humanizeRpcError(rpcError.message) };
    }

    revalidatePath("/profil");
    return { ok: true, slug };
}

function humanizeRpcError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("slug est déjà utilisé"))
        return "Ce nom est déjà pris, essaie une variante.";
    if (lower.includes("slug invalide"))
        return "Le nom contient des caractères invalides.";
    if (lower.includes("limite de 5"))
        return "Tu as atteint la limite de 5 organisations par compte.";
    return msg;
}

// -----------------------------------------------------------------------------
// Helper Server Component : check si l'user a atteint la limite
// -----------------------------------------------------------------------------
export async function getOrganizationCountForCurrentUser(): Promise<number> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    // Compte uniquement les memberships acceptés (pas les invitations en attente)
    const admin = createAdminClient();
    const { count } = await admin
        .from("memberships")
        .select("organization_id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("accepted_at", "is", null);

    return count ?? 0;
}