// =============================================================================
// Edge Function : marketplace-release-escrow
// =============================================================================
// Trigger : pg_cron toutes les 6h via pg_net (header X-Cron-Secret)
//
// Logique :
//   1. Auth via header X-Cron-Secret (compare avec env CRON_RELEASE_ESCROW_SECRET)
//   2. SELECT orders éligibles : status='delivered' AND delivered_at < now()-48h
//      AND stripe_transfer_id IS NULL
//   3. Pour chaque order :
//      a. Charge seller_account → vérif stripe_payouts_enabled
//      b. INSERT payments row pending (kind='c2c_release')
//      c. stripe.transfers.create({ idempotency_key: `release-{order_id}` })
//      d. UPDATE payments → succeeded + stripe_transfer_id
//      e. UPDATE marketplace_orders → released + stripe_transfer_id + released_at
//      f. Audit log
//      g. Mail seller "Paiement versé"
//   4. Réponse JSON { processed, succeeded, failed[] }
//
// Idempotence : Stripe Idempotency-Key + DB garde-fou WHERE stripe_transfer_id IS NULL
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@17.3.0?target=deno";

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_RELEASE_ESCROW_SECRET")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://lasente.eu";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

// -----------------------------------------------------------------------------
// Types légers (on n'a pas accès aux types générés depuis Deno)
// -----------------------------------------------------------------------------

type Order = {
    id: string;
    seller_user_id: string;
    seller_payout_cents: number;
    commission_cents: number;
    listing_id: string;
};

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

serve(async (req) => {
    // --- 1. Auth via secret header
    const provided = req.headers.get("x-cron-secret");
    if (!provided || provided !== CRON_SECRET) {
        return new Response(
            JSON.stringify({ ok: false, error: "Unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    // --- 2. SELECT orders éligibles
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: orders, error: selectErr } = await supabase
        .from("marketplace_orders")
        .select("id, seller_user_id, seller_payout_cents, commission_cents, listing_id")
        .eq("status", "delivered")
        .lt("delivered_at", cutoff)
        .is("stripe_transfer_id", null)
        .limit(50); // batch raisonnable, retry au prochain run si > 50

    if (selectErr) {
        console.error("[release-escrow] SELECT error:", selectErr);
        return new Response(
            JSON.stringify({ ok: false, error: selectErr.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    const eligible = (orders ?? []) as Order[];
    const succeeded: string[] = [];
    const failed: { orderId: string; reason: string }[] = [];

    for (const order of eligible) {
        try {
            await processOrder(order);
            succeeded.push(order.id);
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            console.error(`[release-escrow] order ${order.id} failed:`, reason);
            failed.push({ orderId: order.id, reason });
        }
    }

    return new Response(
        JSON.stringify({
            ok: true,
            processed: eligible.length,
            succeeded: succeeded.length,
            failed: failed.length,
            failures: failed,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
});

// -----------------------------------------------------------------------------
// Process une order
// -----------------------------------------------------------------------------

async function processOrder(order: Order): Promise<void> {
    // a. Charge le seller_account, vérif Stripe payouts enabled
    const { data: sellerAccount, error: saErr } = await supabase
        .from("marketplace_seller_accounts")
        .select("stripe_account_id, stripe_payouts_enabled, kyc_status")
        .eq("user_id", order.seller_user_id)
        .single();

    if (saErr || !sellerAccount) {
        throw new Error(`Seller account introuvable (${saErr?.message ?? "no row"})`);
    }
    if (!sellerAccount.stripe_account_id) {
        throw new Error("Seller sans stripe_account_id");
    }
    if (!sellerAccount.stripe_payouts_enabled) {
        // Skip silencieux, retry au prochain run quand Stripe activera les payouts
        throw new Error("payouts_disabled (retry au prochain run)");
    }

    // b. INSERT payment row pending (idempotence DB)
    // Si une row pending pour ce reference_id existe déjà, on retry depuis là
    const { data: existingPayment } = await supabase
        .from("payments")
        .select("id, status, stripe_transfer_id")
        .eq("kind", "c2c_release")
        .eq("reference_id", order.id)
        .maybeSingle();

    let paymentId: string;
    if (existingPayment) {
        if (existingPayment.status === "succeeded" && existingPayment.stripe_transfer_id) {
            // Edge case : payment déjà succeeded mais order pas update (crash entre les deux).
            // On va juste sync l'order avec le transfer existant.
            await syncOrderFromPayment(order.id, existingPayment.stripe_transfer_id);
            return;
        }
        paymentId = existingPayment.id;
    } else {
        const { data: newPayment, error: insertErr } = await supabase
            .from("payments")
            .insert({
                kind: "c2c_release",
                reference_id: order.id,
                payer_user_id: null, // Sente plateforme paie le seller (système)
                recipient_org_id: null, // C2C : recipient est un user, retracé via reference_id
                amount_cents: order.seller_payout_cents,
                sente_commission_cents: order.commission_cents,
                currency: "eur",
                status: "pending",
            })
            .select("id")
            .single();

        if (insertErr || !newPayment) {
            throw new Error(`INSERT payment failed: ${insertErr?.message}`);
        }
        paymentId = newPayment.id;
    }

    // c. Stripe transfer (avec idempotency key — safe au retry)
    let transfer;
    try {
        transfer = await stripe.transfers.create(
            {
                amount: order.seller_payout_cents,
                currency: "eur",
                destination: sellerAccount.stripe_account_id,
                metadata: {
                    sente_context: "marketplace_c2c_release",
                    order_id: order.id,
                    listing_id: order.listing_id,
                    seller_user_id: order.seller_user_id,
                },
            },
            { idempotencyKey: `release-${order.id}` }
        );
    } catch (err) {
        // Mark payment failed et propage
        await supabase
            .from("payments")
            .update({
                status: "failed",
                raw_event: { error: err instanceof Error ? err.message : String(err) },
            })
            .eq("id", paymentId);
        throw err;
    }

    // d. UPDATE payments succeeded
    await supabase
        .from("payments")
        .update({
            status: "succeeded",
            stripe_transfer_id: transfer.id,
            raw_event: transfer as unknown as Record<string, unknown>,
        })
        .eq("id", paymentId);

    // e. UPDATE order → released (avec garde-fou idempotence)
    const now = new Date().toISOString();
    const { error: updateOrderErr } = await supabase
        .from("marketplace_orders")
        .update({
            status: "released",
            stripe_transfer_id: transfer.id,
            released_at: now,
        })
        .eq("id", order.id)
        .eq("status", "delivered")
        .is("stripe_transfer_id", null);

    if (updateOrderErr) {
        console.error(
            `[release-escrow] order ${order.id} update failed AFTER transfer (${transfer.id}):`,
            updateOrderErr.message
        );
        // On a déjà transféré, on ne throw pas — payment est OK, l'order sera sync au prochain run
        return;
    }

    // f. Audit log
    await supabase.from("audit_log").insert({
        actor_user_id: null,
        action: "marketplace_order.released",
        target_type: "marketplace_order",
        target_id: order.id,
        payload: {
            stripe_transfer_id: transfer.id,
            amount_cents: order.seller_payout_cents,
            auto: true,
        },
    });

    // g. Mail seller (best effort)
    try {
        const { data: authSeller } = await supabase.auth.admin.getUserById(order.seller_user_id);
        const sellerEmail = authSeller?.user?.email;
        if (sellerEmail) {
            await sendPayoutCompletedMail({
                to: sellerEmail,
                orderId: order.id,
                amountCents: order.seller_payout_cents,
            });
        }
    } catch (err) {
        console.error(`[release-escrow] mail seller failed (non-blocking):`, err);
    }
}

// -----------------------------------------------------------------------------
// Sync order si payment succeeded mais order pas update (rare, recovery)
// -----------------------------------------------------------------------------

async function syncOrderFromPayment(orderId: string, transferId: string): Promise<void> {
    await supabase
        .from("marketplace_orders")
        .update({
            status: "released",
            stripe_transfer_id: transferId,
            released_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "delivered")
        .is("stripe_transfer_id", null);
}

// -----------------------------------------------------------------------------
// Mail seller via Resend (fetch direct, pas de SDK pour réduire les imports)
// -----------------------------------------------------------------------------

async function sendPayoutCompletedMail(opts: {
    to: string;
    orderId: string;
    amountCents: number;
}): Promise<void> {
    const eur = (opts.amountCents / 100).toFixed(2);
    const orderUrl = `${SITE_URL}/profil/marketplace/commandes/${opts.orderId}`;

    const text = `Ton paiement a été versé.

Le montant de ${eur} € a été transféré sur ton compte Stripe et sera disponible selon les délais habituels (1-3 jours ouvrés).

Voir la commande : ${orderUrl}

— L'équipe Sente`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f4f0;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e4df;">
        <tr><td style="padding:40px 40px 20px 40px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#666;">Sente — Marketplace</p>
          <h1 style="margin:16px 0 0 0;font-family:Georgia,serif;font-size:32px;font-weight:400;line-height:1.1;color:#1a1a1a;">Paiement versé.</h1>
        </td></tr>
        <tr><td style="padding:0 40px 24px 40px;">
          <div style="border:1px solid #e5e4df;padding:20px;background:#fafaf7;">
            <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Montant transféré</p>
            <p style="margin:0;font-family:Georgia,serif;font-size:32px;color:#4a6741;">${eur} €</p>
          </div>
        </td></tr>
        <tr><td style="padding:0 40px 16px 40px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#444;">
            Le montant a été transféré sur ton compte Stripe et sera disponible selon les délais habituels (1 à 3 jours ouvrés).
          </p>
        </td></tr>
        <tr><td style="padding:0 40px 32px 40px;">
          <a href="${orderUrl}" style="display:inline-block;background:#4a6741;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;">Voir la commande</a>
        </td></tr>
      </table>
      <p style="margin:24px 0 0 0;font-size:11px;color:#999;text-align:center;">Sente — la plateforme de la communauté pêche</p>
    </td></tr>
  </table>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: "Sente <notifications@lasente.eu>",
            to: [opts.to],
            subject: "Paiement versé — Sente Marketplace",
            text,
            html,
        }),
    });

    if (!res.ok) {
        throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
    }
}