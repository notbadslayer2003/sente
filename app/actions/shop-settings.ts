"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrgMember } from "@/lib/auth/assert-org-member";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

// =============================================================================
// Update config boutique (frais de livraison, modes activés)
// =============================================================================

const UpdateShopSettingsSchema = z.object({
    organization_id: z.string().uuid(),
    click_collect_enabled: z.boolean(),
    shipping_standard_enabled: z.boolean(),
    // shipping_standard_fee_cents retiré : calculé au checkout (Sendcloud / autre)
    shipping_local_enabled: z.boolean(),
    shipping_local_fee_cents: z
        .number()
        .int()
        .min(0)
        .max(10000, "Frais trop élevés (max 100€)"),
    shipping_local_zone_desc: z
        .string()
        .max(200, "Description trop longue (max 200)")
        .optional()
        .or(z.literal(""))
        .transform((v) => (v && v.length > 0 ? v : null)),
});

export async function updateShopSettingsAction(
    formData: FormData
): Promise<ActionResult> {
    const localFeeRaw = formData.get("shipping_local_fee_cents");

    const parsed = UpdateShopSettingsSchema.safeParse({
        organization_id: formData.get("organization_id"),
        click_collect_enabled: formData.get("click_collect_enabled") === "true",
        shipping_standard_enabled:
            formData.get("shipping_standard_enabled") === "true",
        shipping_local_enabled: formData.get("shipping_local_enabled") === "true",
        shipping_local_fee_cents:
            typeof localFeeRaw === "string" && localFeeRaw.length > 0
                ? parseInt(localFeeRaw, 10)
                : 0,
        shipping_local_zone_desc: formData.get("shipping_local_zone_desc"),
    });

    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Paramètres invalides",
        };
    }

    if (parsed.data.shipping_local_enabled && !parsed.data.shipping_local_zone_desc) {
        return {
            ok: false,
            error: "Précise ta zone de livraison locale (ex: Mons + 30 km)",
        };
    }

    const auth = await assertOrgMember(parsed.data.organization_id);
    if (!auth.ok) return auth;
    if (auth.role !== "owner" && auth.role !== "admin") {
        return {
            ok: false,
            error: "Seul un propriétaire ou administrateur peut modifier la config boutique",
        };
    }

    const supabase = await createClient();

    const { data: org } = await supabase
        .from("organizations")
        .select("org_type")
        .eq("id", parsed.data.organization_id)
        .maybeSingle();
    if (!org) return { ok: false, error: "Organisation introuvable" };
    if (org.org_type !== "magasin") {
        return { ok: false, error: "Seuls les magasins ont une config boutique" };
    }

    const { error } = await supabase
        .from("shop_settings")
        .upsert(
            {
                organization_id: parsed.data.organization_id,
                click_collect_enabled: parsed.data.click_collect_enabled,
                shipping_standard_enabled: parsed.data.shipping_standard_enabled,
                shipping_standard_fee_cents: 0, // colonne préservée pour compat DB, valeur figée à 0
                shipping_local_enabled: parsed.data.shipping_local_enabled,
                shipping_local_fee_cents: parsed.data.shipping_local_fee_cents,
                shipping_local_zone_desc: parsed.data.shipping_local_zone_desc,
            },
            { onConflict: "organization_id" }
        );

    if (error) {
        console.error("updateShopSettings failed:", error);
        return { ok: false, error: "Erreur de mise à jour." };
    }

    revalidatePath(`/dashboard/[slug]/boutique`, "page");
    revalidatePath(`/dashboard/[slug]/boutique/parametres`, "page");
    revalidatePath(`/magasins/[slug]/boutique`, "page");
    revalidatePath(`/panier`, "page");

    return { ok: true };
}