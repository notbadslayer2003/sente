"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// =============================================================================
// Server Action : updateMyShippingAddress
// =============================================================================
// Met à jour l'adresse d'expédition du seller sur son marketplace_seller_account.
// Différent du KYC (DAC7) : c'est l'adresse opérationnelle d'où le seller envoie
// ses colis, requise par Mondial Relay pour générer les étiquettes.
//
// Pas dépendant du KYC : un seller peut la renseigner à tout moment.
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const shippingAddressSchema = z.object({
    line1: z.string().min(3).max(200),
    postal_code: z.string().min(4).max(10),
    city: z.string().min(2).max(100),
    country: z.enum(["BE", "FR"]),
    // Téléphone : on accepte +32, 0032, ou 0 préfixes belges/français.
    // Validation fine côté MR au moment de l'expédition.
    phone: z.string().min(8).max(20),
});

export async function updateMyShippingAddress(input: {
    line1: string;
    postal_code: string;
    city: string;
    country: "BE" | "FR";
    phone: string;
}): Promise<ActionResult> {
    const parsed = shippingAddressSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false,
            error: { code: "INVALID_INPUT", message: parsed.error.message },
        };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    // Pour rester cohérent avec le pattern seller-kyc.ts : updates via admin client.
    // La table marketplace_seller_accounts a un INSERT-only RLS pour le user,
    // les UPDATE passent par admin (cf seller-kyc.ts).
    const admin = createAdminClient();

    // Vérif qu'un seller_account existe — sinon on ne peut pas update.
    const { data: existing } = await admin
        .from("marketplace_seller_accounts")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!existing) {
        return {
            ok: false,
            error: {
                code: "NO_SELLER_ACCOUNT",
                message:
                    "Tu dois démarrer ton inscription vendeur (KYC) avant de renseigner une adresse d'expédition",
            },
        };
    }

    const { error } = await admin
        .from("marketplace_seller_accounts")
        .update({
            shipping_from_line1: parsed.data.line1,
            shipping_from_postal_code: parsed.data.postal_code,
            shipping_from_city: parsed.data.city,
            shipping_from_country: parsed.data.country,
            shipping_from_phone: parsed.data.phone,
        })
        .eq("user_id", user.id);

    if (error) {
        return {
            ok: false,
            error: { code: "DB_UPDATE_FAILED", message: error.message },
        };
    }

    revalidatePath("/profil/marketplace/compte-vendeur");
    return { ok: true, data: undefined };
}