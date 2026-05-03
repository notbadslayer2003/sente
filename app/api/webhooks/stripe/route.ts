import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Endpoint webhook Stripe.
 * - Vérifie la signature obligatoire (sinon n'importe qui peut nous spammer)
 * - Idempotence via la table webhook_events (PRIMARY KEY = stripe_event_id)
 * - Dispatch sur le type d'event
 *
 * Configurer côté Stripe avec les events :
 *   account.updated
 *   (plus tard : payment_intent.succeeded, charge.refunded, etc.)
 */

export const runtime = "nodejs"; // Stripe SDK nécessite Node, pas Edge

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

    // ─── Idempotence : on insère l'event AVANT de le traiter ───────────────
    const admin = createAdminClient();

    const { error: insertError } = await admin
        .from("webhook_events")
        .insert({
            stripe_event_id: event.id,
            event_type: event.type,
            payload: event as unknown as Record<string, unknown>,
        });

    if (insertError) {
        // Si conflict (event_id déjà reçu) → on a déjà traité, skip silencieux
        if (insertError.code === "23505") {
            console.log(`Webhook ${event.id} already processed, skipping`);
            return NextResponse.json({ received: true, skipped: true });
        }
        console.error("Failed to insert webhook event:", insertError);
        // On retourne 500 pour que Stripe retry plus tard
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    // ─── Dispatch ──────────────────────────────────────────────────────────
    try {
        switch (event.type) {
            case "account.updated":
                await handleAccountUpdated(event.data.object as Stripe.Account);
                break;
            case "capability.updated":
                await handleCapabilityUpdated(event.data.object as Stripe.Capability);
                break;
            // Plus tard : payment_intent.succeeded, charge.refunded, etc.
            default:
                console.log(`Unhandled webhook event type: ${event.type}`);
        }

        // Marque comme traité avec succès
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

    if (error) {
        console.error("update_stripe_account_status failed:", error);
        throw new Error(`RPC failed: ${error.message}`);
    }

    console.log(
        `Stripe account ${account.id} updated: charges=${account.charges_enabled}, payouts=${account.payouts_enabled}, details=${account.details_submitted}`
    );
}

async function handleCapabilityUpdated(capability: Stripe.Capability) {
    // Quand une capability change, on refetch l'account complet pour avoir
    // l'état consolidé (charges_enabled / payouts_enabled / details_submitted).
    const accountId =
        typeof capability.account === "string"
            ? capability.account
            : capability.account?.id;
    if (!accountId) return;

    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(accountId);
    await handleAccountUpdated(account);
}