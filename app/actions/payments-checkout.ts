"use server";

import { z } from "zod";
import { hashToken } from "@/lib/utils/token";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const StartCheckoutSchema = z.object({
    token: z.string().length(64),
});

export async function startCheckoutAction(
    formData: FormData
): Promise<ActionResult<{ url: string }>> {
    const parsed = StartCheckoutSchema.safeParse({
        token: formData.get("token"),
    });
    if (!parsed.success) return { ok: false, error: "Token invalide" };

    const tokenHash = hashToken(parsed.data.token);

    // Lookup via service_role (l'utilisateur peut être anonyme)
    const admin = createAdminClient();
    const { data: sub } = await admin
        .from("pecheur_subscriptions")
        .select(
            `id, etang_id, pecheur_full_name, pecheur_email, saison_year,
         price_cents, paid_amount_cents, payment_status,
         payment_token_expires_at, payment_token_used_at,
         organization:organizations!etang_id(slug, name, stripe_account_id, stripe_charges_enabled)`
        )
        .eq("payment_token_hash", tokenHash)
        .maybeSingle();

    if (!sub) return { ok: false, error: "Lien invalide" };
    if (sub.payment_token_used_at) return { ok: false, error: "Lien déjà utilisé" };
    if (
        sub.payment_token_expires_at &&
        new Date(sub.payment_token_expires_at) < new Date()
    ) {
        return { ok: false, error: "Lien expiré" };
    }
    if (sub.payment_status === "paid") {
        return { ok: false, error: "Déjà payé" };
    }

    const org = Array.isArray(sub.organization) ? sub.organization[0] : sub.organization;

    if (!org?.stripe_account_id || !org.stripe_charges_enabled) {
        return { ok: false, error: "Compte Stripe étang non opérationnel" };
    }

    const { data: etang } = await admin
        .from("etang_details")
        .select("commission_rate_bps")
        .eq("organization_id", sub.etang_id)
        .maybeSingle();

    const remainingCents = sub.price_cents - sub.paid_amount_cents;
    if (remainingCents <= 0) {
        return { ok: false, error: "Rien à payer" };
    }

    const commissionBps = etang?.commission_rate_bps ?? 300;
    const commissionCents = Math.round((remainingCents * commissionBps) / 10000);

    const stripe = getStripeClient();
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    try {
        const session = await stripe.checkout.sessions.create(
            {
                mode: "payment",
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: "eur",
                            unit_amount: remainingCents,
                            product_data: {
                                name: `Abonnement ${sub.saison_year} — ${org.name}`,
                                description: `Pêcheur : ${sub.pecheur_full_name}`,
                            },
                        },
                        quantity: 1,
                    },
                ],
                customer_email: sub.pecheur_email ?? undefined,
                // Direct charge : les frais Stripe sont prélevés sur le compte étang.
                // application_fee_amount est transféré au compte plateforme Sente.
                payment_intent_data: {
                    application_fee_amount: commissionCents,
                    metadata: {
                        sente_subscription_id: sub.id,
                        sente_org_id: sub.etang_id,
                        sente_commission_rate_bps: commissionBps.toString(),
                        sente_amount_cents: remainingCents.toString(),
                        sente_commission_cents: commissionCents.toString(),
                    },
                },
                metadata: {
                    sente_subscription_id: sub.id,
                    sente_org_id: sub.etang_id,
                },
                success_url: `${baseUrl}/payer/succes?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${baseUrl}/payer/${parsed.data.token}?cancelled=1`,
            },
            {
                // Direct charge : la session est créée sur le compte connecté étang.
                // Les frais Stripe et l'encaissement sont sur ce compte.
                stripeAccount: org.stripe_account_id,
            }
        );

        if (!session.url) {
            return { ok: false, error: "Erreur création session" };
        }

        return { ok: true, data: { url: session.url } };
    } catch (err) {
        console.error("Stripe checkout failed:", err);
        return { ok: false, error: "Erreur lors de la création du paiement." };
    }
}