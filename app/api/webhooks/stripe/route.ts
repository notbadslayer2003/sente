import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResendClient } from "@/lib/email/client";
import { buildPaymentConfirmationEmail } from "@/lib/email/templates/payment-confirmation";
import { buildEventRegistrationConfirmEmail } from "@/lib/email/templates/event-registration-confirm";
import { buildShopOrderConfirmEmail } from "@/lib/email/templates/shop-order-confirm";
import {Json} from "@/lib/database.types";

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
            // Subscription billing (plans Sente)
            case "customer.subscription.created":
            case "customer.subscription.updated":
                await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                break;
            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;
            case "invoice.payment_failed":
                await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
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

    // Subscription Sente : pas de Connect, pas de payment_intent direct.
    // La synchro DB est gérée par customer.subscription.created/updated.
    // On early-return ici AVANT de chercher stripe_account_id (qui n'existe
    // pas dans ce contexte).
    const kind = session.metadata?.sente_kind;
    if (kind === "platform_subscription") {
        console.log(
            `Platform subscription checkout completed for session ${session.id}, ` +
            `subscription synced via customer.subscription.created`
        );
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

    if (kind === "shop_order") {
        await handleShopOrderPaid({
            session,
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
            from: "Sente <notifications@lasente.eu>",
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
                from: "Sente <notifications@lasente.eu>",
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

        if (kind === "shop_order_refund" || kind === "shop_order_stock_failure") {
            await rattrapeShopOrderRefund(refund, admin);
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

// ─────────────────────────────────────────────────────────────────────────────
// Handler : shop_order paid (commande e-commerce magasin)
// ─────────────────────────────────────────────────────────────────────────────
async function handleShopOrderPaid(args: {
    session: Stripe.Checkout.Session;
    piId: string;
    chargeId: string | null;
    admin: ReturnType<typeof createAdminClient>;
}) {
    const { session, piId, chargeId, admin } = args;

    const orderId = session.metadata?.sente_order_id;
    if (!orderId) {
        throw new Error(`No sente_order_id in shop_order session ${session.id}`);
    }

    // Customer details (consolidés depuis Stripe)
    const customerDetails = session.customer_details;
    const customerEmail = customerDetails?.email ?? null;
    const customerName = customerDetails?.name ?? null;
    const customerPhone = customerDetails?.phone ?? null;

    // Shipping address (peut être null pour click_collect, sinon stockée dans customer_details.address
    // par Stripe quand shipping_address_collection est activé)
    const shippingAddress: Record<string, unknown> | null =
        customerDetails?.address
            ? {
                name: customerDetails.name,
                address: customerDetails.address,
            }
            : null;

    // Appel RPC : décrémente stock, transitionne paid, vide cart, INSERT payments
    const { error: rpcError } = await admin.rpc("mark_shop_order_paid", {
        p_order_id: orderId,
        p_stripe_session_id: session.id,
        p_stripe_payment_intent_id: piId,
        p_stripe_charge_id: chargeId ?? "",
        p_customer_email: customerEmail ?? "",
        p_customer_name: customerName ?? "",
        p_customer_phone: customerPhone ?? "",
        p_shipping_address: shippingAddress as unknown as Json,
    });

    if (rpcError) {
        // Cas race condition stock : la RPC a fait rollback automatiquement.
        // On doit refunder le buyer (l'argent a été pris par Stripe mais on ne
        // peut pas honorer la commande).
        if (rpcError.message.includes("Stock insuffisant")) {
            console.error(
                `Stock insuffisant pour order ${orderId} au paiement, refund nécessaire`
            );
            await refundShopOrderForStockIssue({
                orderId,
                paymentIntentId: piId,
                stripeAccountId: await getOrgStripeAccountId(orderId, admin),
                reason: "Stock insuffisant au moment du paiement",
            });
            // Marque la commande comme cancelled
            await admin
                .from("orders")
                .update({
                    status: "cancelled",
                    cancelled_at: new Date().toISOString(),
                    refund_reason:
                        "Stock insuffisant au paiement. Remboursement automatique.",
                })
                .eq("id", orderId);
            return;
        }
        throw new Error(`mark_shop_order_paid failed: ${rpcError.message}`);
    }

    console.log(`Shop order ${orderId} marked paid`);

    // Notifie tous les membres du magasin (owner/admin/staff)
    try {
        const { error: notifError } = await admin.rpc("notify_magasin_new_order", {
            p_order_id: orderId,
        });
        if (notifError) {
            console.error(`notify_magasin_new_order failed:`, notifError);
            // On ne re-throw pas : la notif n'est pas critique pour le flux paiement
        }
    } catch (err) {
        console.error("notify_magasin_new_order threw:", err);
    }

    // Email de confirmation au buyer
    await sendShopOrderConfirmationEmail({ orderId, admin });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : récupère le stripe_account_id d'une commande
// ─────────────────────────────────────────────────────────────────────────────
async function getOrgStripeAccountId(
    orderId: string,
    admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
    const { data } = await admin
        .from("orders")
        .select("magasin:organizations!magasin_id(stripe_account_id)")
        .eq("id", orderId)
        .maybeSingle();

    if (!data) return null;
    const magasin = Array.isArray(data.magasin) ? data.magasin[0] : data.magasin;
    return magasin?.stripe_account_id ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : refund automatique en cas de race condition stock
// ─────────────────────────────────────────────────────────────────────────────
async function refundShopOrderForStockIssue(args: {
    orderId: string;
    paymentIntentId: string;
    stripeAccountId: string | null;
    reason: string;
}) {
    if (!args.stripeAccountId) {
        console.error(
            `Cannot refund order ${args.orderId}: no stripe_account_id`
        );
        return;
    }
    try {
        const stripe = getStripeClient();
        await stripe.refunds.create(
            {
                payment_intent: args.paymentIntentId,
                reason: "requested_by_customer",
                metadata: {
                    sente_kind: "shop_order_stock_failure",
                    sente_order_id: args.orderId,
                    sente_refund_reason: args.reason,
                },
            },
            { stripeAccount: args.stripeAccountId }
        );
        console.log(`Auto-refund issued for order ${args.orderId} (stock issue)`);
    } catch (err) {
        console.error(`Auto-refund failed for order ${args.orderId}:`, err);
        // À ce stade on a un buyer débité sans commande honorable et sans refund auto.
        // Le webhook va re-throw, Stripe retry, on aura plusieurs chances. Si tout
        // foire, faut alerter manuellement (Sentry idéalement).
        throw err;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : envoie l'email de confirmation au buyer
// ─────────────────────────────────────────────────────────────────────────────
async function sendShopOrderConfirmationEmail(args: {
    orderId: string;
    admin: ReturnType<typeof createAdminClient>;
}) {
    const { orderId, admin } = args;

    const { data: order } = await admin
        .from("orders")
        .select(
            `id, total_cents, customer_email, customer_name, delivery_method,
             magasin:organizations!magasin_id(name),
             items:order_items!order_id(product_name, variant_name, quantity, line_total_cents)`
        )
        .eq("id", orderId)
        .maybeSingle();

    if (!order || !order.customer_email) {
        console.warn(`Cannot send confirmation email for order ${orderId}: no email`);
        return;
    }

    const magasin = Array.isArray(order.magasin) ? order.magasin[0] : order.magasin;
    const items = (order.items ?? []) as Array<{
        product_name: string;
        variant_name: string | null;
        quantity: number;
        line_total_cents: number;
    }>;

    try {
        const { text, html } = buildShopOrderConfirmEmail({
            customerName: (order.customer_name as string) ?? "Pêcheur",
            orderId: order.id as string,
            magasinName: magasin?.name ?? "Sente",
            deliveryMethod: order.delivery_method as
                | "click_collect"
                | "shipping_standard"
                | "shipping_local",
            totalEur: (order.total_cents as number) / 100,
            items: items.map((it) => ({
                name: it.product_name,
                variant: it.variant_name,
                quantity: it.quantity,
                lineTotalEur: it.line_total_cents / 100,
            })),
        });

        const resend = getResendClient();
        await resend.emails.send({
            from: "Sente <notifications@lasente.eu>",
            to: [order.customer_email as string],
            subject: `Commande confirmée — ${magasin?.name ?? "Sente"}`,
            text,
            html,
        });
    } catch (err) {
        console.error(`Shop order email failed for ${orderId}:`, err);
        // On ne re-throw PAS : si l'email plante, ça ne doit pas casser le webhook
        // (la commande est bien marked paid, c'est l'essentiel).
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : rattrape un refund shop_order arrivé via webhook
// (cas où le refund est initié hors Sente, p.ex. depuis le dashboard Stripe
//  du magasin, ou notre auto-refund stock failure)
// ─────────────────────────────────────────────────────────────────────────────
async function rattrapeShopOrderRefund(
    refund: Stripe.Refund,
    admin: ReturnType<typeof createAdminClient>
) {
    const orderId = refund.metadata?.sente_order_id;
    if (!orderId) {
        console.warn(
            `Shop refund ${refund.id} sans sente_order_id, skip rattrapage`
        );
        return;
    }

    // Cas 1 : refund auto pour stock failure → on ne crée pas de ligne payments
    // (la commande est cancelled, pas de tracking refund par item à faire).
    // On insère quand même une ligne payments minimaliste pour traçabilité,
    // sans refunds_parent_id (pas de payment original puisque mark_shop_order_paid
    // a fait rollback).
    if (refund.metadata?.sente_kind === "shop_order_stock_failure") {
        const { data: order } = await admin
            .from("orders")
            .select("buyer_user_id, magasin_id")
            .eq("id", orderId)
            .maybeSingle();
        if (!order) return;

        await admin.from("payments").insert({
            kind: "refund",
            reference_id: orderId,
            payer_user_id: order.buyer_user_id,
            recipient_org_id: order.magasin_id,
            amount_cents: refund.amount,
            sente_commission_cents: 0,
            currency: "eur",
            stripe_charge_id:
                typeof refund.charge === "string"
                    ? refund.charge
                    : refund.charge?.id ?? "",
            stripe_refund_id: refund.id,
            status: "paid",
        });
        console.log(`Stock-failure refund ${refund.id} traced for order ${orderId}`);
        return;
    }

    // Cas 2 : refund sur item, initié hors Sente. On a besoin du order_item_id
    // pour appeler record_order_item_refund. Si le magasin a fait un refund
    // total depuis le dashboard Stripe sans préciser quel item, on refund
    // proportionnellement sur tous les items (rare, fallback).
    const orderItemId = refund.metadata?.sente_order_item_id;
    const refundQuantity = parseInt(
        refund.metadata?.sente_refund_quantity ?? "1",
        10
    );

    if (!orderItemId) {
        console.warn(
            `Shop refund ${refund.id} sans sente_order_item_id, fallback non implémenté`
        );
        // TODO : si tu veux gérer le refund total via dashboard Stripe sans metadata,
        // implémenter une logique de répartition. Pour le MVP on log et on skip.
        return;
    }

    // Calcule la commission proportionnelle à rembourser
    const { data: order } = await admin
        .from("orders")
        .select("commission_rate_bps")
        .eq("id", orderId)
        .maybeSingle();
    const commissionRefund = order
        ? Math.round((refund.amount * order.commission_rate_bps) / 10000)
        : 0;

    const reason =
        refund.metadata?.sente_refund_reason ??
        "Remboursement enregistré automatiquement (webhook)";

    const { error: rpcError } = await admin.rpc("record_order_item_refund", {
        p_order_item_id: orderItemId,
        p_refund_quantity: refundQuantity,
        p_refund_amount_cents: refund.amount,
        p_commission_refund_cents: commissionRefund,
        p_reason: reason,
        p_stripe_refund_id: refund.id,
        p_stripe_charge_id:
            typeof refund.charge === "string"
                ? refund.charge
                : refund.charge?.id ?? "",
    });

    if (rpcError) {
        console.error(
            `record_order_item_refund failed for refund ${refund.id}:`,
            rpcError
        );
        throw new Error(`record_order_item_refund failed: ${rpcError.message}`);
    }

    console.log(`Shop order refund ${refund.id} enregistré : ${refund.amount} cents`);
}

// =============================================================================
// SUBSCRIPTION BILLING HANDLERS
// =============================================================================

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
    const admin = createAdminClient();

    // Trouve l'org via stripe_customer_id
    const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const { data: orgIdData, error: lookupError } = await admin.rpc(
        "find_org_by_stripe_customer",
        { p_customer_id: customerId }
    );

    if (lookupError || !orgIdData) {
        // Cas possible : subscription créée hors Sente (manuel dans Dashboard
        // Stripe) → on n'a pas de mapping. On log et skip plutôt que throw,
        // sinon Stripe va retry indéfiniment.
        console.warn(
            `Subscription ${sub.id} : aucune org Sente liée au customer ${customerId}, skip`
        );
        return;
    }

    // Récupère le price ID actif (premier item de la subscription)
    const item = sub.items.data[0];
    if (!item) {
        throw new Error(`Subscription ${sub.id} sans items`);
    }
    const priceId = item.price.id;

    // Map vers plan Sente
    const { getPlanIdFromStripePriceId } = await import("@/lib/stripe/billing");
    const planMapping = getPlanIdFromStripePriceId(priceId);
    if (!planMapping) {
        console.warn(
            `Subscription ${sub.id} : price ${priceId} non mappé à un plan Sente, skip`
        );
        return;
    }

    // Map status Stripe → notre enum
    const status = mapStripeSubscriptionStatus(sub.status);

    // current_period_end peut être en seconds (timestamp Unix)
    // ⚠️ Stripe a changé l'API : current_period_end est maintenant sur l'item
    const periodEnd = item.current_period_end ?? null;
    const periodEndDate = periodEnd ? new Date(periodEnd * 1000) : null;

    const { error: rpcError } = await admin.rpc("apply_subscription_update", {
        p_org_id: orgIdData,
        p_subscription_id: sub.id,
        p_status: status,
        p_current_period_end: (periodEndDate?.toISOString() ?? null) as string,
        p_cancel_at_period_end: sub.cancel_at_period_end,
        p_plan_id: planMapping.planId,
    });

    if (rpcError) {
        throw new Error(`apply_subscription_update failed: ${rpcError.message}`);
    }

    console.log(
        `Subscription ${sub.id} synced: org=${orgIdData}, plan=${planMapping.planId}, status=${status}, cancel_at_period_end=${sub.cancel_at_period_end}`
    );
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const admin = createAdminClient();
    const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const { data: orgIdData } = await admin.rpc("find_org_by_stripe_customer", {
        p_customer_id: customerId,
    });

    if (!orgIdData) {
        console.warn(`Subscription deleted ${sub.id} : org introuvable`);
        return;
    }

    // Status canceled → la RPC remet le plan à vitrine/starter
    const { error: rpcError } = await admin.rpc("apply_subscription_update", {
        p_org_id: orgIdData,
        p_subscription_id: sub.id,
        p_status: "canceled",
        p_current_period_end: null as unknown as string,
        p_cancel_at_period_end: false,
        p_plan_id: "vitrine", // ignoré côté SQL quand status=canceled
    });

    if (rpcError) {
        throw new Error(`apply_subscription_update (delete) failed: ${rpcError.message}`);
    }

    console.log(`Subscription ${sub.id} deleted, org ${orgIdData} downgraded`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const admin = createAdminClient();
    const customerId =
        typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

    if (!customerId) {
        console.warn(`Invoice ${invoice.id} sans customer, skip`);
        return;
    }

    const { data: orgIdData } = await admin.rpc("find_org_by_stripe_customer", {
        p_customer_id: customerId,
    });

    if (!orgIdData) {
        console.warn(`Invoice payment failed : org introuvable pour customer ${customerId}`);
        return;
    }

    // On marque past_due. Stripe va retry plusieurs fois sur 3 semaines.
    // Si tous les retries échouent, customer.subscription.deleted sera émis.
    await admin
        .from("organizations")
        .update({
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
        })
        .eq("id", orgIdData);

    console.log(
        `Invoice ${invoice.id} payment failed, org ${orgIdData} marqué past_due`
    );

    // TODO : envoyer un email au owner pour qu'il mette à jour sa carte
    // (à faire en 5.D avec Customer Portal)
}

/**
 * Mapping status Stripe → notre enum subscription_status.
 * Stripe a 8 statuses, on en regroupe certains :
 * - active, trialing → active
 * - past_due, unpaid → past_due (= grace period, on garde l'accès)
 * - canceled, incomplete_expired → canceled
 * - incomplete → free (pas encore vraiment payé)
 */
function mapStripeSubscriptionStatus(
    status: Stripe.Subscription.Status
): "free" | "active" | "past_due" | "canceled" {
    switch (status) {
        case "active":
        case "trialing":
            return "active";
        case "past_due":
        case "unpaid":
            return "past_due";
        case "canceled":
        case "incomplete_expired":
            return "canceled";
        case "incomplete":
        case "paused":
            return "free";
        default:
            return "free";
    }
}