import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient } from "@/lib/email/client";
import { buildPaymentConfirmationEmail } from "@/lib/email/templates/payment-confirmation";
import { buildEventRegistrationConfirmEmail } from "@/lib/email/templates/event-registration-confirm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = (await headers()).get("stripe-signature");

    if (!sig) {
        return NextResponse.json(
            { error: "Missing stripe-signature header" },
            { status: 400 }
        );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET manquante");
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const stripe = getStripeClient();
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Idempotence
    const { error: insertError } = await admin
        .from("webhook_events")
        .insert({
            stripe_event_id: event.id,
            event_type: event.type,
            payload: event as any
        });

    if (insertError) {
        if (insertError.code === "23505") {
            return NextResponse.json({ received: true, skipped: true });
        }
        console.error("Failed to insert webhook event:", insertError);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    try {
        switch (event.type) {
            case "account.updated":
                await handleAccountUpdated(event.data.object as Stripe.Account);
                break;
            case "capability.updated":
                await handleCapabilityUpdated(event.data.object as Stripe.Capability);
                break;
            case "checkout.session.completed":
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;
            case "charge.refunded":
                await handleChargeRefunded(event.data.object as Stripe.Charge);
                break;
            default:
                console.log(`Unhandled webhook event type: ${event.type}`);
        }

        await admin
            .from("webhook_events")
            .update({ processed_at: new Date().toISOString() })
            .eq("stripe_event_id", event.id);
    } catch (err) {
        console.error(`Error processing webhook ${event.id}:`, err);
        await admin
            .from("webhook_events")
            .update({
                error_message: err instanceof Error ? err.message : String(err),
            })
            .eq("stripe_event_id", event.id);
        return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}

async function handleAccountUpdated(account: Stripe.Account) {
    const admin = createAdminClient();
    const { error } = await admin.rpc("update_stripe_account_status", {
        p_stripe_account_id: account.id,
        p_charges_enabled: account.charges_enabled ?? false,
        p_payouts_enabled: account.payouts_enabled ?? false,
        p_details_submitted: account.details_submitted ?? false,
    });

    if (error) throw new Error(`RPC failed: ${error.message}`);

    console.log(
        `Stripe account ${account.id} updated: charges=${account.charges_enabled}, payouts=${account.payouts_enabled}, details=${account.details_submitted}`
    );
}

async function handleCapabilityUpdated(capability: Stripe.Capability) {
    const accountId =
        typeof capability.account === "string"
            ? capability.account
            : capability.account?.id;
    if (!accountId) return;

    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(accountId);
    await handleAccountUpdated(account);
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout completed : route selon sente_kind (event_registration | subscription)
// ─────────────────────────────────────────────────────────────────────────────
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.payment_status !== "paid") {
        console.log(`Checkout session ${session.id} not paid yet, skipping`);
        return;
    }

    const orgId = session.metadata?.sente_org_id;
    if (!orgId) {
        throw new Error(`No sente_org_id in session ${session.id}`);
    }

    const admin = createAdminClient();
    const { data: org } = await admin
        .from("organizations")
        .select("stripe_account_id")
        .eq("id", orgId)
        .single();

    if (!org?.stripe_account_id) {
        throw new Error(`No stripe_account_id for org ${orgId}`);
    }

    const stripe = getStripeClient();
    const piId =
        typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
    if (!piId) throw new Error(`No payment_intent on session ${session.id}`);

    // En direct charge, le PI vit sur le compte connecté
    const pi = await stripe.paymentIntents.retrieve(
        piId,
        { expand: ["latest_charge"] },
        { stripeAccount: org.stripe_account_id }
    );

    const amountCents = pi.amount_received ?? pi.amount;
    const applicationFee = pi.application_fee_amount ?? 0;
    const charge = pi.latest_charge as Stripe.Charge | null;
    const chargeId = typeof charge === "object" && charge ? charge.id : null;

    // Dispatch selon kind
    const kind = session.metadata?.sente_kind;

    if (kind === "event_registration") {
        await handleEventRegistrationPaid({
            session,
            amountCents,
            applicationFee,
            piId: pi.id,
            chargeId,
            admin,
        });
        return;
    }

    // Cas par défaut : abonnement pêcheur étang (legacy, sans sente_kind)
    await handleSubscriptionPaid({
        session,
        amountCents,
        applicationFee,
        piId: pi.id,
        chargeId,
        admin,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : event_registration paid
// ─────────────────────────────────────────────────────────────────────────────
async function handleEventRegistrationPaid(args: {
    session: Stripe.Checkout.Session;
    amountCents: number;
    applicationFee: number;
    piId: string;
    chargeId: string | null;
    admin: ReturnType<typeof createAdminClient>;
}) {
    const { session, amountCents, applicationFee, piId, chargeId, admin } = args;

    const registrationId = session.metadata?.sente_registration_id;
    if (!registrationId) {
        throw new Error(`No sente_registration_id in event session ${session.id}`);
    }

    const { error: rpcError } = await admin.rpc("mark_event_registration_paid", {
        p_registration_id: registrationId,
        p_amount_cents: amountCents,
        p_commission_cents: applicationFee,
        p_stripe_payment_intent_id: piId,
        p_stripe_charge_id: chargeId ?? "",
    });
    if (rpcError) {
        throw new Error(`mark_event_registration_paid failed: ${rpcError.message}`);
    }

    console.log(
        `Event registration ${registrationId} marked paid: ${amountCents} cents, commission ${applicationFee} cents`
    );

    // Email confirmation au pêcheur
    const { data: reg } = await admin
        .from("event_registrations")
        .select(
            `full_name, email, payment_method, paid_amount_cents,
             event:events!event_id(id, title, starts_at, location_text,
                organization:organizations!organization_id(name))`
        )
        .eq("id", registrationId)
        .single();

    if (!reg) return;

    const event = Array.isArray(reg.event) ? reg.event[0] : reg.event;
    if (!event) return;
    const orgRel = Array.isArray(event.organization)
        ? event.organization[0]
        : event.organization;
    if (!orgRel) return;

    try {
        const { text, html } = buildEventRegistrationConfirmEmail({
            fullName: reg.full_name as string,
            eventTitle: event.title as string,
            orgName: orgRel.name as string,
            startsAt: event.starts_at as string,
            locationText: (event.location_text as string) ?? null,
            paymentMethod: reg.payment_method as string,
            paidAmountEur: (reg.paid_amount_cents as number) / 100,
        });
        const resend = getResendClient();
        await resend.emails.send({
            from: "Sente <onboarding@resend.dev>",
            to: [reg.email as string],
            subject: `Inscription confirmée — ${event.title}`,
            text,
            html,
        });
    } catch (err) {
        console.error("Event registration email failed:", err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : subscription paid (legacy abonnements pêcheurs étang)
// ─────────────────────────────────────────────────────────────────────────────
async function handleSubscriptionPaid(args: {
    session: Stripe.Checkout.Session;
    amountCents: number;
    applicationFee: number;
    piId: string;
    chargeId: string | null;
    admin: ReturnType<typeof createAdminClient>;
}) {
    const { session, amountCents, applicationFee, piId, chargeId, admin } = args;

    const subscriptionId = session.metadata?.sente_subscription_id;
    if (!subscriptionId) {
        throw new Error(`No sente_subscription_id in session ${session.id}`);
    }

    const commissionCents =
        parseInt(session.metadata?.sente_commission_cents ?? "0", 10) ||
        applicationFee ||
        0;
    const commissionRateBps = parseInt(
        session.metadata?.sente_commission_rate_bps ?? "300",
        10
    );

    const { error: rpcError } = await admin.rpc("mark_subscription_paid", {
        p_subscription_id: subscriptionId,
        p_amount_cents: amountCents,
        p_commission_cents: commissionCents,
        p_commission_rate_bps: commissionRateBps,
        p_stripe_payment_intent_id: piId,
        p_stripe_charge_id: chargeId ?? "",
    });

    if (rpcError) {
        throw new Error(`mark_subscription_paid failed: ${rpcError.message}`);
    }

    console.log(
        `Subscription ${subscriptionId} marked paid: ${amountCents} cents, commission ${commissionCents} cents`
    );

    // Email confirmation
    const { data: sub } = await admin
        .from("pecheur_subscriptions")
        .select(
            `pecheur_full_name, pecheur_email, saison_year, start_date, end_date,
             organization:organizations!etang_id(name)`
        )
        .eq("id", subscriptionId)
        .single();

    if (sub?.pecheur_email) {
        const orgRel = Array.isArray(sub.organization)
            ? sub.organization[0]
            : sub.organization;

        const { text, html } = buildPaymentConfirmationEmail({
            pecheurName: sub.pecheur_full_name,
            etangName: orgRel?.name ?? "l'étang",
            amountEur: amountCents / 100,
            saisonYear: sub.saison_year,
            startDate: new Date(sub.start_date).toLocaleDateString("fr-BE"),
            endDate: new Date(sub.end_date).toLocaleDateString("fr-BE"),
        });

        try {
            const resend = getResendClient();
            await resend.emails.send({
                from: "Sente <onboarding@resend.dev>",
                to: [sub.pecheur_email],
                subject: `Paiement reçu — ${orgRel?.name ?? "Sente"}`,
                text,
                html,
            });
        } catch (err) {
            console.error("Confirmation email failed:", err);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Charge refunded : route selon sente_kind aussi
// ─────────────────────────────────────────────────────────────────────────────
async function handleChargeRefunded(charge: Stripe.Charge) {
    const refunds = charge.refunds?.data ?? [];
    if (refunds.length === 0) return;

    const admin = createAdminClient();

    for (const refund of refunds) {
        // Skip si déjà en DB
        const { data: existing } = await admin
            .from("payments")
            .select("id")
            .eq("stripe_refund_id", refund.id)
            .maybeSingle();
        if (existing) continue;

        const kind = refund.metadata?.sente_kind;

        if (kind === "event_refund") {
            await rattrapeEventRefund(refund, admin);
            continue;
        }

        // Fallback : refund sur abonnement pêcheur (legacy, sans kind)
        await rattrapeSubscriptionRefund(refund, admin);
    }
}

async function rattrapeEventRefund(
    refund: Stripe.Refund,
    admin: ReturnType<typeof createAdminClient>
) {
    const regId = refund.metadata?.sente_registration_id;
    if (!regId) {
        console.warn(`Event refund ${refund.id} sans sente_registration_id, skip`);
        return;
    }

    const { data: reg } = await admin
        .from("event_registrations")
        .select("id, paid_amount_cents, sente_commission_cents, refunded_amount_cents")
        .eq("id", regId)
        .single();

    if (!reg) {
        console.warn(`Registration ${regId} introuvable pour refund ${refund.id}`);
        return;
    }

    const commissionRefundCents =
        (reg.paid_amount_cents as number) > 0
            ? Math.round(
                ((reg.sente_commission_cents as number) * refund.amount) /
                (reg.paid_amount_cents as number)
            )
            : 0;

    const reason =
        refund.metadata?.sente_refund_reason ??
        "Remboursement enregistré automatiquement (webhook)";

    const { error: rpcError } = await admin.rpc("record_event_refund", {
        p_registration_id: regId,
        p_refund_amount_cents: refund.amount,
        p_commission_refund_cents: commissionRefundCents,
        p_reason: reason,
        p_stripe_refund_id: refund.id,
        p_stripe_charge_id:
            typeof refund.charge === "string"
                ? refund.charge
                : refund.charge?.id ?? "",
    });

    if (rpcError) {
        console.error(
            `record_event_refund failed for refund ${refund.id}:`,
            rpcError
        );
        throw new Error(`record_event_refund failed: ${rpcError.message}`);
    }

    console.log(`Event refund ${refund.id} enregistré : ${refund.amount} cents`);
}

async function rattrapeSubscriptionRefund(
    refund: Stripe.Refund,
    admin: ReturnType<typeof createAdminClient>
) {
    const subId = refund.metadata?.sente_subscription_id;
    if (!subId) {
        console.warn(`Refund ${refund.id} sans sente_subscription_id, skip`);
        return;
    }

    const { data: sub } = await admin
        .from("pecheur_subscriptions")
        .select(
            "id, paid_amount_cents, sente_commission_cents, refunded_amount_cents"
        )
        .eq("id", subId)
        .single();

    if (!sub) {
        console.warn(`Subscription ${subId} introuvable pour refund ${refund.id}`);
        return;
    }

    const commissionRefundCents =
        (sub.paid_amount_cents as number) > 0
            ? Math.round(
                ((sub.sente_commission_cents as number) * refund.amount) /
                (sub.paid_amount_cents as number)
            )
            : 0;

    const reason =
        refund.metadata?.sente_refund_reason ??
        "Remboursement enregistré automatiquement (webhook)";

    const { error: rpcError } = await admin.rpc("record_refund", {
        p_subscription_id: subId,
        p_refund_amount_cents: refund.amount,
        p_commission_refund_cents: commissionRefundCents,
        p_reason: reason,
        p_stripe_refund_id: refund.id,
        p_stripe_charge_id:
            typeof refund.charge === "string"
                ? refund.charge
                : refund.charge?.id ?? "",
    });

    if (rpcError) {
        console.error(
            `record_refund failed via webhook for refund ${refund.id}:`,
            rpcError
        );
        throw new Error(`record_refund failed: ${rpcError.message}`);
    }

    console.log(`Subscription refund ${refund.id} enregistré : ${refund.amount} cents`);
}