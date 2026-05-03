"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { getResendClient } from "@/lib/email/client";
import { buildEventRefundEmail } from "@/lib/email/templates/event-refund";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const RefundSchema = z.object({
    registration_id: z.string().uuid(),
    refund_amount_eur: z.coerce
        .number()
        .min(0.01, "Montant minimum 0,01 €")
        .max(100000),
    reason: z
        .string()
        .min(10, "Raison trop courte (min 10 caractères)")
        .max(1000)
        .transform((v) => v.trim()),
});

export async function refundEventRegistrationAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RefundSchema.safeParse({
        registration_id: formData.get("registration_id"),
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

    const { data: reg } = await supabase
        .from("event_registrations")
        .select(
            `id, payment_method, payment_status, paid_amount_cents, refunded_amount_cents,
             sente_commission_cents, stripe_payment_intent_id, full_name, email,
             event:events!event_id(id, title, organization_id,
                organization:organizations!organization_id(id, name, stripe_account_id))`
        )
        .eq("id", parsed.data.registration_id)
        .single();
    if (!reg) return { ok: false, error: "Inscription introuvable." };

    const event = Array.isArray(reg.event) ? reg.event[0] : reg.event;
    if (!event) return { ok: false, error: "Événement introuvable." };
    const org = Array.isArray(event.organization) ? event.organization[0] : event.organization;
    if (!org?.stripe_account_id) return { ok: false, error: "Compte Stripe org manquant." };

    // Owner/admin check
    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", event.organization_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        return { ok: false, error: "Seuls les owners et admins peuvent rembourser." };
    }

    if (reg.payment_method !== "online_card" || !reg.stripe_payment_intent_id) {
        return {
            ok: false,
            error: "Cette inscription n'a pas été payée en ligne, refund manuel.",
        };
    }

    const refundAmountCents = Math.round(parsed.data.refund_amount_eur * 100);
    const refundable = (reg.paid_amount_cents as number) - (reg.refunded_amount_cents as number);
    if (refundable <= 0) return { ok: false, error: "Aucun montant remboursable." };
    if (refundAmountCents > refundable) {
        return {
            ok: false,
            error: `Maximum remboursable : ${(refundable / 100).toFixed(2)} €`,
        };
    }

    // Commission proportionnelle
    const commissionRefundCents =
        (reg.paid_amount_cents as number) > 0
            ? Math.round(
                ((reg.sente_commission_cents as number) * refundAmountCents) /
                (reg.paid_amount_cents as number)
            )
            : 0;

    // Stripe refund (direct charge → pas de reverse_transfer)
    const stripe = getStripeClient();
    let stripeRefundId: string;
    let stripeChargeId: string | null = null;
    try {
        const refund = await stripe.refunds.create(
            {
                payment_intent: reg.stripe_payment_intent_id,
                amount: refundAmountCents,
                reason: "requested_by_customer",
                refund_application_fee: true,
                metadata: {
                    sente_kind: "event_refund",
                    sente_registration_id: reg.id,
                    sente_event_id: event.id,
                    sente_org_id: event.organization_id,
                    sente_refund_reason: parsed.data.reason,
                },
            },
            { stripeAccount: org.stripe_account_id }
        );
        stripeRefundId = refund.id;
        stripeChargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id ?? null;
    } catch (err) {
        const e = err as Error;
        console.error("Stripe refund failed:", e);
        return { ok: false, error: `Stripe a refusé : ${e.message}` };
    }

    // Persiste via RPC admin client
    const admin = createAdminClient();
    const { error: rpcError } = await admin.rpc("record_event_refund", {
        p_registration_id: reg.id,
        p_refund_amount_cents: refundAmountCents,
        p_commission_refund_cents: commissionRefundCents,
        p_reason: parsed.data.reason,
        p_stripe_refund_id: stripeRefundId,
        p_stripe_charge_id: stripeChargeId,
    });
    if (rpcError) {
        console.error("record_event_refund failed after Stripe refund:", rpcError);
        return {
            ok: false,
            error: "Refund Stripe accepté mais erreur DB. Le webhook rattrapera.",
        };
    }

    // Email pêcheur
    try {
        const { text, html } = buildEventRefundEmail({
            fullName: reg.full_name as string,
            eventTitle: event.title as string,
            orgName: org.name as string,
            refundAmountEur: refundAmountCents / 100,
            reason: parsed.data.reason,
        });
        const resend = getResendClient();
        await resend.emails.send({
            from: "Sente <onboarding@resend.dev>",
            to: [reg.email as string],
            subject: `Remboursement reçu — ${event.title}`,
            text,
            html,
        });
    } catch (err) {
        console.error("Email refund failed:", err);
    }

    revalidatePath("/dashboard/[slug]/evenements/[id]/inscrits", "page");
    return { ok: true };
}