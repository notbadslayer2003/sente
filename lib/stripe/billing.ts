import { getMagasinPlan, getEtangPlan } from "@/lib/constants/plans";

/**
 * Mapping plan → Price ID Stripe.
 * Les Price IDs sont créés dans le Dashboard Stripe (mode test puis live).
 * Stockés en envs pour pouvoir switcher test/live sans toucher au code.
 *
 * Si tu ajoutes un plan payant à l'avenir, ajoute son Price ID ici + envs.
 */
export function getStripePriceIdForPlan(
    orgType: "etang" | "magasin",
    planId: string
): string | null {
    if (orgType === "etang" && planId === "crm") {
        return process.env.STRIPE_PRICE_ID_ETANG_CRM ?? null;
    }
    if (orgType === "magasin" && planId === "pro") {
        return process.env.STRIPE_PRICE_ID_MAGASIN_PRO ?? null;
    }
    // Plans gratuits : pas de Price ID, pas de subscription nécessaire
    return null;
}

/**
 * Inverse : depuis un Price ID Stripe (reçu dans webhook), retourne quel plan
 * c'est. Utilisé pour synchroniser le plan effectif au webhook.
 */
export function getPlanIdFromStripePriceId(priceId: string): {
    orgType: "etang" | "magasin";
    planId: string;
} | null {
    if (priceId === process.env.STRIPE_PRICE_ID_ETANG_CRM) {
        return { orgType: "etang", planId: "crm" };
    }
    if (priceId === process.env.STRIPE_PRICE_ID_MAGASIN_PRO) {
        return { orgType: "magasin", planId: "pro" };
    }
    return null;
}

/**
 * Vérifie qu'un plan est valide pour un type d'org (defense in depth).
 */
export function isPlanValidForOrgType(
    orgType: "etang" | "magasin",
    planId: string
): boolean {
    if (orgType === "etang") {
        const plan = getEtangPlan(planId);
        return plan.id === planId; // si l'id est inconnu, getEtangPlan fallback sur vitrine
    }
    if (orgType === "magasin") {
        const plan = getMagasinPlan(planId);
        return plan.id === planId;
    }
    return false;
}