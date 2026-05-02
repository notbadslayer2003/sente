import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResendClient(): Resend {
    if (!_resend) {
        const key = process.env.RESEND_API_KEY;
        if (!key) {
            throw new Error("RESEND_API_KEY manquante dans l'environnement");
        }
        _resend = new Resend(key);
    }
    return _resend;
}