"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { getResendClient } from "@/lib/email/client";
import { buildRefundConfirmationEmail } from "@/lib/email/templates/refund-confirmation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const RefundSchema = z.object({
    subscription_id: z.string().uuid(),
    refund_amount_eur: z.coerce
        .number()
        .min(0.01, "Montant minimum 0,01 €")
        .max(100000, "Montant trop élevé"),
    reason: z
        .string()
        .min(10, "Raison trop courte (min 10 caractères)")
        .max(1000, "Raison trop longue (max 1000 caractères)")
        .transform((v) => v.trim()),
});

export async function refundSubscriptionAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RefundSchema.safeParse({
        subscription_id: formData.get("subscription_id"),
        refund_amount_eur: formData.get("refund_amount_eur"),
        reason: formData.get("reason"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Champs invalides",
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // Récupère l'abonnement complet
    const { data: sub } = await supabase
        .from("pecheur_subscriptions")
        .select(
            `id, etang_id, pecheur_full_name, pecheur_email, saison_year,
             paid_amount_cents, refunded_amount_cents, sente_commission_cents,
             payment_status, stripe_payment_intent_id,
             organization:organizations!etang_id(name, stripe_account_id)`
        )
        .eq("id", parsed.data.subscription_id)
        .single();

    if (!sub) return { ok: false, error: "Abonnement introuvable" };

    // L'utilisateur doit être owner ou admin de l'étang
    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", sub.etang_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();

    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return { ok: false, error: "Seuls les owners et admins peuvent rembourser." };
    }

    // Validations métier
    if (!sub.stripe_payment_intent_id) {
        return {
            ok: false,
            error: "Cet abonnement n'a pas été payé en ligne. Le remboursement doit se faire manuellement.",
        };
    }

    const refundAmountCents = Math.round(parsed.data.refund_amount_eur * 100);
    const refundable = sub.paid_amount_cents - sub.refunded_amount_cents;

    if (refundable <= 0) {
        return { ok: false, error: "Aucun montant remboursable." };
    }
    if (refundAmountCents > refundable) {
        return {
            ok: false,
            error: `Maximum remboursable : ${(refundable / 100).toFixed(2)} €`,
        };
    }

    const org = Array.isArray(sub.organization)
        ? sub.organization[0]
        : sub.organization;

    if (!org?.stripe_account_id) {
        return { ok: false, error: "Compte Stripe étang introuvable." };
    }

    // Calcul de la commission proportionnelle à rembourser à Sente
    // (Sente rend la part de commission correspondant au refund pour rester équitable)
    const commissionRefundCents =
        sub.paid_amount_cents > 0
            ? Math.round(
                (sub.sente_commission_cents * refundAmountCents) /
                sub.paid_amount_cents
            )
            : 0;

    // Crée le refund Stripe (sur le compte connecté étang)
    const stripe = getStripeClient();
    let stripeRefundId: string;
    let stripeChargeId: string | null = null;

    try {
        const refund = await stripe.refunds.create(
            {
                payment_intent: sub.stripe_payment_intent_id,
                amount: refundAmountCents,
                reason: "requested_by_customer",
                refund_application_fee: true, // Sente rend sa commission
                metadata: {
                    sente_subscription_id: sub.id,
                    sente_org_id: sub.etang_id,
                    sente_refund_reason: parsed.data.reason,
                },
            },
            {
                stripeAccount: org.stripe_account_id,
            }
        );
        stripeRefundId = refund.id;
        stripeChargeId =
            typeof refund.charge === "string"
                ? refund.charge
                : refund.charge?.id ?? null;
    } catch (err) {
        const e = err as Error;
        console.error("Stripe refund failed:", e);
        return {
            ok: false,
            error: `Stripe a refusé le remboursement : ${e.message}`,
        };
    }

    // Persiste le refund en DB via RPC (audit + cohérence)
    const admin = createAdminClient();
    const { error: rpcError } = await admin.rpc("record_refund", {
        p_subscription_id: sub.id,
        p_refund_amount_cents: refundAmountCents,
        p_commission_refund_cents: commissionRefundCents,
        p_reason: parsed.data.reason,
        p_stripe_refund_id: stripeRefundId,
        p_stripe_charge_id: stripeChargeId,
    });

    if (rpcError) {
        // Stripe a refundé mais on n'a pas pu persister. Le webhook charge.refunded
        // viendra rattraper. On log et on remonte une erreur informative.
        console.error("record_refund RPC failed after Stripe refund:", rpcError);
        return {
            ok: false,
            error:
                "Refund Stripe accepté mais erreur d'enregistrement. Le statut sera mis à jour automatiquement dans quelques secondes.",
        };
    }

    // Email confirmation au pêcheur
    if (sub.pecheur_email) {
        try {
            const { text, html } = buildRefundConfirmationEmail({
                pecheurName: sub.pecheur_full_name,
                etangName: org.name,
                refundAmountEur: refundAmountCents / 100,
                reason: parsed.data.reason,
            });
            const resend = getResendClient();
            await resend.emails.send({
                from: "Sente <onboarding@resend.dev>",
                to: [sub.pecheur_email],
                subject: `Remboursement reçu — ${org.name}`,
                text,
                html,
            });
        } catch (err) {
            // Email facultatif, on n'échoue pas si Resend plante
            console.error("Refund email failed:", err);
        }
    }

    revalidatePath("/dashboard/[slug]/registre", "page");
    revalidatePath("/dashboard/[slug]/paiements/historique", "page");
    return { ok: true };
}