import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Client Stripe singleton, instancié à la demande.
 * Utilise toujours la dernière API version stable au build.
 */
export function getStripeClient(): Stripe {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
        _stripe = new Stripe(key, {
            apiVersion: "2026-04-22.dahlia",
            typescript: true,
            telemetry: false,
        });
    }
    return _stripe;
}