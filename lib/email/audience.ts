import { getResendClient } from "./client";

/**
 * Synchronise un user avec l'audience marketing Resend.
 *
 * Stratégie soft unsubscribe : on ne supprime jamais un contact, on flip juste
 * `unsubscribed`. Avantages :
 *  - Si l'user re-opt-in, on retrouve son historique
 *  - Resend bloque automatiquement les emails aux contacts unsubscribed
 *  - Cohérent avec RGPD (on conserve la trace du consentement)
 *
 * Best-effort : les erreurs sont loggées mais n'interrompent jamais le flow
 * utilisateur (sauver son profil reste prioritaire sur le sync audience).
 */
export async function syncMarketingOptIn(args: {
    email: string;
    optIn: boolean;
    firstName?: string | null;
    lastName?: string | null;
}): Promise<void> {
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (!audienceId) {
        console.warn("[audience] RESEND_AUDIENCE_ID manquant, sync skippée");
        return;
    }

    const resend = getResendClient();
    const { email, optIn, firstName, lastName } = args;

    try {
        if (optIn) {
            // Tente create d'abord. Si déjà existe (409 typiquement), update.
            try {
                await resend.contacts.create({
                    audienceId,
                    email,
                    firstName: firstName ?? undefined,
                    lastName: lastName ?? undefined,
                    unsubscribed: false,
                });
            } catch {
                // Probablement un conflict "contact existe déjà" → on update
                await resend.contacts.update({
                    audienceId,
                    email,
                    firstName: firstName ?? undefined,
                    lastName: lastName ?? undefined,
                    unsubscribed: false,
                });
            }
        } else {
            // Soft unsubscribe — on garde le contact, juste marqué unsubscribed
            await resend.contacts.update({
                audienceId,
                email,
                unsubscribed: true,
            });
        }
    } catch (err) {
        // Best-effort : log mais on ne casse pas le flow utilisateur
        console.error("[audience] sync failed:", err);
    }
}