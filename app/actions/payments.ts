"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateInvitationToken, hashToken } from "@/lib/utils/token";
import { getResendClient } from "@/lib/email/client";
import { buildPaymentLinkEmail } from "@/lib/email/templates/payment-link";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const CreatePaymentLinkSchema = z.object({
    subscription_id: z.string().uuid(),
});

export async function createPaymentLinkAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = CreatePaymentLinkSchema.safeParse({
        subscription_id: formData.get("subscription_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // Récupère l'abonnement + l'étang + l'email du pêcheur
    const { data: sub } = await supabase
        .from("pecheur_subscriptions")
        .select(
            `id, etang_id, pecheur_full_name, pecheur_email, saison_year,
             price_cents, paid_amount_cents, payment_status,
             organization:organizations!etang_id(name, stripe_charges_enabled)`
        )
        .eq("id", parsed.data.subscription_id)
        .single();

    if (!sub) return { ok: false, error: "Abonnement introuvable" };

    if (!sub.pecheur_email) {
        return {
            ok: false,
            error: "Email du pêcheur manquant. Modifie l'abonnement pour ajouter un email.",
        };
    }

    const org = Array.isArray(sub.organization)
        ? sub.organization[0]
        : sub.organization;
    if (!org?.stripe_charges_enabled) {
        return {
            ok: false,
            error: "Le compte Stripe de l'étang n'est pas encore validé. Configure les paiements depuis l'onglet Paiements.",
        };
    }

    // Calcul du restant dû
    const remainingCents = sub.price_cents - sub.paid_amount_cents;
    if (remainingCents <= 0) {
        return { ok: false, error: "Cet abonnement est déjà entièrement payé." };
    }

    // Génère le token + hash
    const tokenClair = generateInvitationToken();
    const tokenHash = hashToken(tokenClair);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

    // Persiste via RPC (audit + checks)
    const { error: rpcError } = await supabase.rpc("create_payment_token", {
        p_subscription_id: parsed.data.subscription_id,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt.toISOString(),
    });
    if (rpcError) {
        console.error("create_payment_token failed:", rpcError);
        return { ok: false, error: humanizePaymentError(rpcError.message) };
    }

    // Envoi email
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const payUrl = `${baseUrl}/payer/${tokenClair}`;

    const { text, html } = buildPaymentLinkEmail({
        pecheurName: sub.pecheur_full_name,
        etangName: org.name,
        amountEur: remainingCents / 100,
        saisonYear: sub.saison_year,
        payUrl,
        expiresInDays: 7,
    });

    try {
        const resend = getResendClient();
        await resend.emails.send({
            from: "Sente <onboarding@resend.dev>",
            to: [sub.pecheur_email],
            subject: `Paiement en attente — ${org.name}`,
            text,
            html,
        });
    } catch (err) {
        console.error("Resend email failed:", err);
        return {
            ok: false,
            error: "Token créé mais email non envoyé. Renvoie-le plus tard.",
        };
    }

    revalidatePath("/dashboard/[slug]/registre", "page");
    return { ok: true };
}

function humanizePaymentError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("entièrement payé"))
        return "Cet abonnement est déjà entièrement payé.";
    if (lower.includes("pas en attente"))
        return "Cet abonnement n'est plus en attente de paiement.";
    if (lower.includes("introuvable")) return "Abonnement introuvable.";
    if (lower.includes("accès refusé")) return "Accès refusé.";
    return msg;
}