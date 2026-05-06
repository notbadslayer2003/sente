"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import {
    getStripePriceIdForPlan,
    isPlanValidForOrgType,
} from "@/lib/stripe/billing";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

// =============================================================================
// CHECKOUT — créer une subscription
// =============================================================================

const CreateCheckoutSchema = z.object({
    org_id: z.string().uuid(),
    plan_id: z.string().min(1),
});

/**
 * Crée une checkout session Stripe pour upgrade vers un plan payant.
 *
 * Flow :
 * 1. Vérifie que l'utilisateur est owner/admin de l'org
 * 2. Vérifie que le plan demandé est cohérent avec le type d'org
 * 3. Crée (ou réutilise) le Stripe Customer pour cette org
 * 4. Crée la checkout session en mode subscription
 * 5. Retourne l'URL Stripe pour redirect côté client
 *
 * Pas de webhook nécessaire au retour : le webhook
 * checkout.session.completed sera émis par Stripe.
 */
export async function createSubscriptionCheckoutAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = CreateCheckoutSchema.safeParse({
        org_id: formData.get("org_id"),
        plan_id: formData.get("plan_id"),
    });
    if (!parsed.success) {
        return { ok: false, error: "Paramètres invalides" };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Authentification requise" };

    // 1. Check droits sur l'org
    const { data: membership } = await supabase
        .from("memberships")
        .select("role, organization_id")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
        return {
            ok: false,
            error: "Tu dois être owner ou admin pour gérer l'abonnement",
        };
    }

    // 2. Récupère l'org (admin client : on a besoin du stripe_customer_id même si RLS)
    const admin = createAdminClient();
    const { data: org } = await admin
        .from("organizations")
        .select("id, slug, name, org_type, stripe_customer_id")
        .eq("id", parsed.data.org_id)
        .single();
    if (!org) return { ok: false, error: "Organisation introuvable" };

    if (org.org_type !== "etang" && org.org_type !== "magasin") {
        return { ok: false, error: "Type d'organisation non éligible" };
    }

    // 3. Check plan valide pour ce type d'org
    if (!isPlanValidForOrgType(org.org_type, parsed.data.plan_id)) {
        return { ok: false, error: "Plan invalide pour ce type d'organisation" };
    }

    const priceId = getStripePriceIdForPlan(org.org_type, parsed.data.plan_id);
    if (!priceId) {
        return {
            ok: false,
            error: "Plan non disponible à l'achat (gratuit ou non configuré)",
        };
    }

    const stripe = getStripeClient();

    // 4. Get/Create Stripe Customer pour cette org
    let customerId = org.stripe_customer_id;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email ?? undefined,
            name: org.name,
            metadata: {
                sente_org_id: org.id,
                sente_org_type: org.org_type,
            },
        });
        customerId = customer.id;

        // Persiste l'ID en DB (idempotent : la RPC ne update que si null)
        const { error: linkError } = await admin.rpc("link_org_stripe_customer", {
            p_org_id: org.id,
            p_stripe_customer_id: customerId,
        });
        if (linkError) {
            console.error("link_org_stripe_customer failed:", linkError);
            return { ok: false, error: "Erreur de configuration billing" };
        }
    }

    // 5. Crée la checkout session
    const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    try {
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${siteUrl}/dashboard/${org.slug}/parametres?upgraded=1`,
            cancel_url: `${siteUrl}/dashboard/${org.slug}/parametres`,
            metadata: {
                sente_kind: "platform_subscription",
                sente_org_id: org.id,
                sente_plan_id: parsed.data.plan_id,
            },
            subscription_data: {
                metadata: {
                    sente_org_id: org.id,
                    sente_plan_id: parsed.data.plan_id,
                },
            },
            // Optimisations UX
            allow_promotion_codes: true,
            billing_address_collection: "auto",
        });

        if (!session.url) {
            return { ok: false, error: "URL Stripe manquante" };
        }

        return { ok: true, data: { url: session.url } };
    } catch (err) {
        console.error("Stripe checkout creation failed:", err);
        return {
            ok: false,
            error: "Erreur Stripe. Réessaie ou contacte le support.",
        };
    }
}

// =============================================================================
// CANCEL — annuler en fin de période
// =============================================================================

const CancelSchema = z.object({
    org_id: z.string().uuid(),
});

export async function cancelSubscriptionAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = CancelSchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Authentification requise" };

    // Check droits
    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
        return { ok: false, error: "Droits insuffisants" };
    }

    const admin = createAdminClient();
    const { data: org } = await admin
        .from("organizations")
        .select("slug, stripe_subscription_id, subscription_status")
        .eq("id", parsed.data.org_id)
        .single();

    if (!org?.stripe_subscription_id) {
        return { ok: false, error: "Aucun abonnement actif à annuler" };
    }

    const stripe = getStripeClient();
    try {
        await stripe.subscriptions.update(org.stripe_subscription_id, {
            cancel_at_period_end: true,
        });
        // Le webhook customer.subscription.updated va sync la DB automatiquement
    } catch (err) {
        console.error("Stripe cancel failed:", err);
        return { ok: false, error: "Erreur Stripe lors de l'annulation" };
    }

    revalidatePath(`/dashboard/${org.slug}/parametres`);
    return { ok: true };
}

// =============================================================================
// REACTIVATE — annuler l'annulation programmée
// =============================================================================

export async function reactivateSubscriptionAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = CancelSchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Authentification requise" };

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
        return { ok: false, error: "Droits insuffisants" };
    }

    const admin = createAdminClient();
    const { data: org } = await admin
        .from("organizations")
        .select("slug, stripe_subscription_id")
        .eq("id", parsed.data.org_id)
        .single();

    if (!org?.stripe_subscription_id) {
        return { ok: false, error: "Aucun abonnement à réactiver" };
    }

    const stripe = getStripeClient();
    try {
        await stripe.subscriptions.update(org.stripe_subscription_id, {
            cancel_at_period_end: false,
        });
    } catch (err) {
        console.error("Stripe reactivate failed:", err);
        return { ok: false, error: "Erreur Stripe lors de la réactivation" };
    }

    revalidatePath(`/dashboard/${org.slug}/parametres`);
    return { ok: true };
}

// =============================================================================
// CUSTOMER PORTAL — gestion self-service via Stripe
// =============================================================================

const PortalSchema = z.object({
    org_id: z.string().uuid(),
});

/**
 * Crée une session de Customer Portal Stripe.
 * Le portal est une page hostée par Stripe où l'utilisateur peut :
 * - Mettre à jour sa carte bancaire
 * - Voir ses factures
 * - Annuler son abonnement
 *
 * Pas besoin de webhook : les changements faits dans le portal génèrent
 * les events customer.subscription.updated qu'on traite déjà.
 */
export async function createCustomerPortalAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = PortalSchema.safeParse({
        org_id: formData.get("org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Authentification requise" };

    // Check droits
    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.org_id)
        .eq("user_id", user.id)
        .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
        return { ok: false, error: "Droits insuffisants" };
    }

    const admin = createAdminClient();
    const { data: org } = await admin
        .from("organizations")
        .select("slug, stripe_customer_id")
        .eq("id", parsed.data.org_id)
        .single();

    if (!org?.stripe_customer_id) {
        return {
            ok: false,
            error: "Aucun compte Stripe lié. Effectue un upgrade d'abord.",
        };
    }

    const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const stripe = getStripeClient();
    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: org.stripe_customer_id,
            return_url: `${siteUrl}/dashboard/${org.slug}/parametres`,
        });
        return { ok: true, data: { url: session.url } };
    } catch (err) {
        console.error("Stripe portal session creation failed:", err);
        return {
            ok: false,
            error: "Erreur Stripe. Réessaie ou contacte le support.",
        };
    }
}