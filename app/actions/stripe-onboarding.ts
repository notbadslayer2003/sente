"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const CreateAccountSchema = z.object({
    org_id: z.string().uuid(),
});

/**
 * Crée un compte Stripe Connect Express pour une org si elle n'en a pas déjà
 * un, puis génère un account link d'onboarding (KYC) que l'org va parcourir.
 *
 * Retourne l'URL d'onboarding à laquelle on redirige l'utilisateur.
 */
export async function createStripeOnboardingLinkAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = CreateAccountSchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // Vérifie que l'utilisateur est owner/admin de l'org
    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return { ok: false, error: "Accès refusé" };
    }

    // Charge l'org pour récupérer le pays et l'éventuel account_id existant
    const { data: org } = await supabase
        .from("organizations")
        .select(
            "id, slug, name, country, contact_email, stripe_account_id, org_type"
        )
        .eq("id", parsed.data.org_id)
        .single();

    if (!org) return { ok: false, error: "Organisation introuvable" };

    const stripe = getStripeClient();
    let accountId = org.stripe_account_id;

    // Crée le compte Stripe Connect si l'org n'en a pas
    if (!accountId) {
        try {
            const account = await stripe.accounts.create({
                type: "express",
                country: org.country, // 'BE' ou 'FR'
                email: org.contact_email ?? user.email ?? undefined,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_type: "company",
                metadata: {
                    sente_org_id: org.id,
                    sente_org_slug: org.slug,
                    sente_org_type: org.org_type,
                },
            });
            accountId = account.id;

            // Persiste via RPC (autorisation + audit)
            const { error: rpcError } = await supabase.rpc(
                "set_stripe_account_id",
                {
                    p_org_id: org.id,
                    p_stripe_account_id: accountId,
                }
            );
            if (rpcError) {
                console.error("set_stripe_account_id failed:", rpcError);
                return {
                    ok: false,
                    error: "Compte Stripe créé mais échec persistance.",
                };
            }
        } catch (err) {
            console.error("Stripe account create failed:", err);
            return {
                ok: false,
                error: "Erreur lors de la création du compte Stripe.",
            };
        }
    }

    // Génère un account link (URL d'onboarding KYC, valide 5 minutes)
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    try {
        const link = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${baseUrl}/dashboard/${org.slug}/paiements?onboarding=refresh`,
            return_url: `${baseUrl}/dashboard/${org.slug}/paiements?onboarding=complete`,
            type: "account_onboarding",
        });

        return { ok: true, data: { url: link.url } };
    } catch (err) {
        console.error("Stripe accountLink create failed:", err);
        return {
            ok: false,
            error: "Erreur lors de la génération du lien d'onboarding.",
        };
    }
}

/**
 * Génère un lien vers le Stripe Express Dashboard, où l'org peut consulter
 * ses payouts, modifier son IBAN, etc. Lien valide quelques minutes.
 */
export async function createStripeDashboardLinkAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = CreateAccountSchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return { ok: false, error: "Accès refusé" };
    }

    const { data: org } = await supabase
        .from("organizations")
        .select("stripe_account_id")
        .eq("id", parsed.data.org_id)
        .single();

    if (!org?.stripe_account_id) {
        return { ok: false, error: "Compte Stripe non créé." };
    }

    try {
        const stripe = getStripeClient();
        const link = await stripe.accounts.createLoginLink(org.stripe_account_id);
        return { ok: true, data: { url: link.url } };
    } catch (err) {
        console.error("Stripe loginLink create failed:", err);
        return { ok: false, error: "Erreur lors de la génération du lien." };
    }
}

/**
 * Force un refresh du statut Stripe en relisant l'account côté Stripe et
 * en mettant à jour la DB. Utile quand l'utilisateur veut savoir où il en est
 * sans attendre les webhooks.
 */
export async function refreshStripeAccountAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = CreateAccountSchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return { ok: false, error: "Accès refusé" };
    }

    const { data: org } = await supabase
        .from("organizations")
        .select("stripe_account_id")
        .eq("id", parsed.data.org_id)
        .single();
    if (!org?.stripe_account_id) {
        return { ok: false, error: "Compte Stripe non configuré." };
    }

    try {
        const stripe = getStripeClient();
        const account = await stripe.accounts.retrieve(org.stripe_account_id);

        // Update via service_role pour bypass RLS (idem webhook)
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        await admin.rpc("update_stripe_account_status", {
            p_stripe_account_id: account.id,
            p_charges_enabled: account.charges_enabled ?? false,
            p_payouts_enabled: account.payouts_enabled ?? false,
            p_details_submitted: account.details_submitted ?? false,
        });

        const { revalidatePath } = await import("next/cache");
        revalidatePath("/dashboard/[slug]/paiements", "page");

        return { ok: true };
    } catch (err) {
        console.error("Stripe refresh failed:", err);
        return { ok: false, error: "Erreur lors du rafraîchissement." };
    }
}