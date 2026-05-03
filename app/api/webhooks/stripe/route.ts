import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient } from "@/lib/email/client";
import { buildPaymentConfirmationEmail } from "@/lib/email/templates/payment-confirmation";

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
            payload: event as unknown as Record<string, unknown>,
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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.payment_status !== "paid") {
        console.log(`Checkout session ${session.id} not paid yet, skipping`);
        return;
    }

    const subscriptionId = session.metadata?.sente_subscription_id;
    if (!subscriptionId) {
        throw new Error(`No sente_subscription_id in session ${session.id}`);
    }

    // En direct charge, le PaymentIntent vit sur le compte connecté.
    // On retrouve l'org via la metadata pour récupérer son stripe_account_id.
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

    // Précise le compte connecté pour retrieve
    const pi = await stripe.paymentIntents.retrieve(
        piId,
        { expand: ["latest_charge"] },
        { stripeAccount: org.stripe_account_id }
    );

    const amountCents = pi.amount_received ?? pi.amount;
    const commissionCents =
        parseInt(session.metadata?.sente_commission_cents ?? "0", 10) ||
        pi.application_fee_amount ||
        0;
    const commissionRateBps = parseInt(
        session.metadata?.sente_commission_rate_bps ?? "300",
        10
    );

    const charge = pi.latest_charge as Stripe.Charge | null;
    const chargeId = typeof charge === "object" && charge ? charge.id : null;

    const { error: rpcError } = await admin.rpc("mark_subscription_paid", {
        p_subscription_id: subscriptionId,
        p_amount_cents: amountCents,
        p_commission_cents: commissionCents,
        p_commission_rate_bps: commissionRateBps,
        p_stripe_payment_intent_id: pi.id,
        p_stripe_charge_id: chargeId,
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