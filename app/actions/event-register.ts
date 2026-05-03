"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { getResendClient } from "@/lib/email/client";
import { buildEventRegistrationConfirmEmail } from "@/lib/email/templates/event-registration-confirm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const RegisterSchema = z.object({
    event_id: z.string().uuid(),
    full_name: z
        .string()
        .min(2, "Nom requis (min 2 caractères)")
        .max(120, "Nom trop long")
        .transform((v) => v.trim()),
    phone: z
        .string()
        .max(50)
        .nullable()
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
    payment_method: z.enum(["online_card", "on_site_cash", "free"]),
    notes: z
        .string()
        .max(1000, "Notes trop longues")
        .nullable()
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

export async function registerToEventAction(
    formData: FormData
): Promise<ActionResult<{ registration_id: string; requires_payment: boolean; checkout_url?: string }>> {
    const parsed = RegisterSchema.safeParse({
        event_id: formData.get("event_id"),
        full_name: formData.get("full_name"),
        phone: formData.get("phone"),
        payment_method: formData.get("payment_method"),
        notes: formData.get("notes"),
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

    // RPC : crée la registration
    const { data, error } = await supabase
        .rpc("register_to_event", {
            p_event_id: parsed.data.event_id,
            p_full_name: parsed.data.full_name,
            p_phone: parsed.data.phone ?? "",
            p_payment_method: parsed.data.payment_method,
            p_notes: parsed.data.notes ?? "",
        })
        .single();

    if (error) {
        console.error("register_to_event failed:", error);
        return { ok: false, error: humanizeRegistrationError(error.message) };
    }

    type RPCRow = { registration_id: string; requires_payment: boolean; amount_cents: number };
    const row = data as unknown as RPCRow;
    const registrationId = row.registration_id;
    const requiresPayment = row.requires_payment;
    const amountCents = row.amount_cents;

    // Cas 1 : event gratuit ou paiement on-site → on s'arrête là
    if (!requiresPayment) {
        // Email confirmation
        await sendConfirmationEmail(supabase, registrationId).catch((err) => {
            console.error("Email confirmation failed:", err);
        });
        revalidatePath("/profil/inscriptions");
        revalidatePath("/evenements/[id]", "page");
        return { ok: true, data: { registration_id: registrationId, requires_payment: false } };
    }

    // Cas 2 : online_card → Stripe Checkout direct charge
    // Récupère l'event + org pour stripeAccount + commission
    const admin = createAdminClient();
    const { data: regContext } = await admin
        .from("event_registrations")
        .select(
            `id, full_name, email, sente_commission_rate_bps,
             event:events!event_id(id, title, organization_id),
             org:events!event_id(organization:organizations!organization_id(id, name, stripe_account_id))`
        )
        .eq("id", registrationId)
        .single();

    if (!regContext) {
        return { ok: false, error: "Erreur de récupération de l'inscription." };
    }

    const eventRow = Array.isArray(regContext.event) ? regContext.event[0] : regContext.event;
    if (!eventRow) return { ok: false, error: "Événement introuvable." };

    const { data: orgRow } = await admin
        .from("organizations")
        .select("id, name, stripe_account_id")
        .eq("id", eventRow.organization_id)
        .single();

    if (!orgRow?.stripe_account_id) {
        return { ok: false, error: "Compte Stripe étang manquant." };
    }

    const commissionBps = (regContext.sente_commission_rate_bps as number) ?? 300;
    const applicationFee = Math.round((amountCents * commissionBps) / 10000);

    const stripe = getStripeClient();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    let checkoutUrl: string;
    try {
        const session = await stripe.checkout.sessions.create(
            {
                mode: "payment",
                payment_method_types: ["card", "bancontact"],
                line_items: [
                    {
                        price_data: {
                            currency: "eur",
                            product_data: {
                                name: eventRow.title,
                                description: `Inscription événement — ${orgRow.name}`,
                            },
                            unit_amount: amountCents,
                        },
                        quantity: 1,
                    },
                ],
                payment_intent_data: {
                    application_fee_amount: applicationFee,
                    metadata: {
                        sente_kind: "event_registration",
                        sente_registration_id: registrationId,
                        sente_event_id: eventRow.id,
                        sente_org_id: orgRow.id,
                    },
                },
                customer_email: regContext.email,
                metadata: {
                    sente_kind: "event_registration",
                    sente_registration_id: registrationId,
                    sente_event_id: eventRow.id,
                    sente_org_id: orgRow.id,
                },
                success_url: `${baseUrl}/evenements/${eventRow.id}/inscription/succes?registration=${registrationId}`,
                cancel_url: `${baseUrl}/evenements/${eventRow.id}/inscription?cancelled=1`,
            },
            {
                stripeAccount: orgRow.stripe_account_id,
            }
        );

        if (!session.url) {
            return { ok: false, error: "Erreur Stripe (URL absente)." };
        }
        checkoutUrl = session.url;
    } catch (err) {
        console.error("Stripe checkout creation failed:", err);
        return { ok: false, error: "Erreur lors de la création du paiement." };
    }

    return {
        ok: true,
        data: {
            registration_id: registrationId,
            requires_payment: true,
            checkout_url: checkoutUrl,
        },
    };
}

async function sendConfirmationEmail(
    supabase: Awaited<ReturnType<typeof createClient>>,
    registrationId: string
): Promise<void> {
    const { data: reg } = await supabase
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
    const org = Array.isArray(event.organization) ? event.organization[0] : event.organization;
    if (!org) return;

    const { text, html } = buildEventRegistrationConfirmEmail({
        fullName: reg.full_name,
        eventTitle: event.title,
        orgName: org.name,
        startsAt: event.starts_at,
        locationText: event.location_text ?? null,
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
}

function humanizeRegistrationError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("déjà inscrit")) return "Tu es déjà inscrit à cet événement.";
    if (lower.includes("complet")) return "Cet événement est complet.";
    if (lower.includes("inscriptions fermées")) return "Inscriptions fermées (événement non publié ou passé).";
    if (lower.includes("événement passé")) return "Cet événement est déjà passé.";
    if (lower.includes("paiement en ligne") && lower.includes("disponible"))
        return "Le paiement en ligne n'est pas disponible pour cet événement.";
    if (lower.includes("événement payant")) return "Cet événement est payant, choisis une méthode de paiement.";
    if (lower.includes("membre") && lower.includes("inscrire")) return "En tant que membre, pas besoin de t'inscrire.";
    return msg;
}