"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";
import { mapStripeAccountToKycState } from "@/lib/marketplace/kyc-mapper";

// =============================================================================
// Types & schemas
// =============================================================================

const initSellerKycSchema = z.object({
    country: z.enum(["BE", "FR"]),
    vendorTermsVersion: z.string().min(1).max(20),
});

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

// =============================================================================
// Helpers
// =============================================================================

function getReturnUrls() {
    // Construit les URLs de retour Stripe à partir du host courant.
    // En prod : process.env.NEXT_PUBLIC_SITE_URL recommandé.
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
    if (!base) {
        throw new Error("NEXT_PUBLIC_SITE_URL manquante");
    }
    return {
        return_url: `${base}/profil/marketplace/compte-vendeur?status=success`,
        refresh_url: `${base}/profil/marketplace/compte-vendeur?status=refresh`,
    };
}

// =============================================================================
// Action : initSellerKyc
// =============================================================================

/**
 * Démarre ou reprend le KYC vendeur :
 * - Si pas de seller_account : crée la ligne + Stripe Connect Express + AccountLink
 * - Si seller_account déjà créé mais pas verified : régénère un AccountLink
 * - Si verified : erreur (rien à faire)
 *
 * Retourne l'URL d'onboarding Stripe à laquelle rediriger l'utilisateur.
 */
export async function initSellerKyc(input: {
    country: "BE" | "FR";
    vendorTermsVersion: string;
}): Promise<ActionResult<{ onboardingUrl: string }>> {
    const parsed = initSellerKycSchema.safeParse(input);
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

    // Vérifier que l'utilisateur n'est pas un pro (membership magasin/etang)
    // (le trigger DB le bloquerait à l'INSERT listing, mais autant éviter le KYC inutile)
    const { data: memberships } = await supabase
        .from("memberships")
        .select("organization_id, organizations!inner(org_type, deleted_at)")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null);

    const hasProMembership = memberships?.some(
        (m) =>
            (m.organizations.org_type === "magasin" || m.organizations.org_type === "etang") &&
            m.organizations.deleted_at === null
    );

    if (hasProMembership) {
        return {
            ok: false,
            error: {
                code: "PRO_ACCOUNT_FORBIDDEN",
                message: "Les comptes liés à un magasin ou un étang ne peuvent pas vendre sur le marketplace C2C",
            },
        };
    }

    // Charger ou créer le seller_account
    const existing = await supabase
        .from("marketplace_seller_accounts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (existing.data?.kyc_status === "verified") {
        return {
            ok: false,
            error: { code: "ALREADY_VERIFIED", message: "KYC déjà validé" },
        };
    }

    if (existing.data?.kyc_status === "restricted") {
        return {
            ok: false,
            error: {
                code: "RESTRICTED",
                message: `Compte restreint : ${existing.data.restricted_reason ?? "raison inconnue"}. Contactez le support.`,
            },
        };
    }

    const stripe = getStripeClient();
    const admin = createAdminClient();

    let stripeAccountId = existing.data?.stripe_account_id ?? null;

    // Création du compte Stripe Connect Express si nécessaire
    if (!stripeAccountId) {
        const account = await stripe.accounts.create({
            type: "express",
            country: parsed.data.country,
            email: user.email,
            business_type: "individual",
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            metadata: {
                sente_user_id: user.id,
                sente_context: "marketplace_c2c",
            },
        });
        stripeAccountId = account.id;
    }

    // Upsert du seller_account avec le stripe_account_id
    // On utilise admin client pour bypass RLS (UPDATE est admin-only)
    if (existing.data) {
        const { error: updateError } = await admin
            .from("marketplace_seller_accounts")
            .update({
                stripe_account_id: stripeAccountId,
                kyc_status: "pending",
                dac7_country_residence: parsed.data.country,  // ← AJOUT
                vendor_terms_accepted_at: new Date().toISOString(),
                vendor_terms_version: parsed.data.vendorTermsVersion,
            })
            .eq("user_id", user.id);

        if (updateError) {
            return {
                ok: false,
                error: { code: "DB_UPDATE_FAILED", message: updateError.message },
            };
        }
    } else {
        // INSERT initial — passe la RLS user (policy owner_insert)
        const { error: insertError } = await supabase
            .from("marketplace_seller_accounts")
            .insert({
                user_id: user.id,
                kyc_status: "not_started",
                stripe_account_id: null,
                stripe_charges_enabled: false,
                stripe_payouts_enabled: false,
            });

        if (insertError) {
            return {
                ok: false,
                error: { code: "DB_INSERT_FAILED", message: insertError.message },
            };
        }

        // Puis update via admin pour stripe_account_id + vendor_terms (champs protégés)
        const { error: updateError } = await admin
            .from("marketplace_seller_accounts")
            .update({
                stripe_account_id: stripeAccountId,
                kyc_status: "pending",
                dac7_country_residence: parsed.data.country,  // ← AJOUTER ICI
                vendor_terms_accepted_at: new Date().toISOString(),
                vendor_terms_version: parsed.data.vendorTermsVersion,
            })
            .eq("user_id", user.id);

        if (updateError) {
            return {
                ok: false,
                error: { code: "DB_UPDATE_FAILED", message: updateError.message },
            };
        }
    }

    // Génération de l'AccountLink (URL onboarding Stripe)
    const urls = getReturnUrls();
    const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        return_url: urls.return_url,
        refresh_url: urls.refresh_url,
        type: "account_onboarding",
    });

    revalidatePath("/profil/marketplace/compte-vendeur");
    return { ok: true, data: { onboardingUrl: accountLink.url } };
}

// =============================================================================
// Action : refreshKycStatus (utile au retour de Stripe)
// =============================================================================

/**
 * Force un refresh de l'account Stripe : récupère le state actuel et met à jour
 * la DB. Utile au retour de l'utilisateur depuis Stripe (avant que le webhook
 * arrive). Idempotent.
 */
export async function refreshKycStatus(): Promise<ActionResult<{ kyc_status: string }>> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const { data: account } = await supabase
        .from("marketplace_seller_accounts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!account?.stripe_account_id) {
        return { ok: false, error: { code: "NO_STRIPE_ACCOUNT", message: "Aucun KYC en cours" } };
    }

    const stripe = getStripeClient();
    const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);

    const admin = createAdminClient();
    const { kyc_status, dac7Updates } = mapStripeAccountToKycState(stripeAccount);

    // 1er update : on applique les updates Stripe
    const { error } = await admin
        .from("marketplace_seller_accounts")
        .update({
            kyc_status,
            stripe_charges_enabled: stripeAccount.charges_enabled ?? false,
            stripe_payouts_enabled: stripeAccount.payouts_enabled ?? false,
            stripe_details_submitted: stripeAccount.details_submitted ?? false,
            ...dac7Updates,
        })
        .eq("user_id", user.id);

    if (error) {
        return { ok: false, error: { code: "DB_UPDATE_FAILED", message: error.message } };
    }

    // 2e check : on relit la DB et on promeut en 'verified' si tous les champs requis sont remplis
    // (Stripe n'expose pas country/birth_date/address → ils viennent du formulaire utilisateur)
    const { data: refreshed } = await admin
        .from("marketplace_seller_accounts")
        .select("*")
        .eq("user_id", user.id)
        .single();

    if (
        refreshed &&
        refreshed.kyc_status !== "verified" &&
        refreshed.stripe_charges_enabled &&
        refreshed.stripe_payouts_enabled &&
        refreshed.stripe_details_submitted &&
        refreshed.dac7_legal_first_name &&
        refreshed.dac7_legal_last_name &&
        refreshed.dac7_birth_date &&
        refreshed.dac7_country_residence &&
        refreshed.dac7_address_full &&
        refreshed.dac7_tin
    ) {
        await admin
            .from("marketplace_seller_accounts")
            .update({
                kyc_status: "verified",
                kyc_completed_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);

        return { ok: true, data: { kyc_status: "verified" } };
    }

    return { ok: true, data: { kyc_status: refreshed?.kyc_status ?? kyc_status } };
}

const submitDac7InfoSchema = z.object({
    tin: z.string().min(8).max(50),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD attendu"),
    address_full: z.string().min(10).max(500),
});

export async function submitDac7Info(input: {
    tin: string;
    birth_date: string;
    address_full: string;
}): Promise<ActionResult> {
    const parsed = submitDac7InfoSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const admin = createAdminClient();
    const { error } = await admin
        .from("marketplace_seller_accounts")
        .update({
            dac7_tin: parsed.data.tin,
            dac7_birth_date: parsed.data.birth_date,
            dac7_address_full: parsed.data.address_full,
            dac7_verified_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

    if (error) {
        return { ok: false, error: { code: "DB_UPDATE_FAILED", message: error.message } };
    }

    await refreshKycStatus();
    return { ok: true, data: undefined };
}