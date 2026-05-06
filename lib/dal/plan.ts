import { createClient } from "@/lib/supabase/server";
import {
    getEtangPlan,
    getMagasinPlan,
    type EtangPlan,
    type MagasinPlan,
} from "@/lib/constants/plans";

export type OrgPlanInfo = {
    /** Type de l'org pour switcher entre plans étang/magasin */
    orgType: "etang" | "magasin";
    /** ID brut du plan (vitrine/crm/starter/pro) */
    planId: string;
    /** Métadonnées du plan (limites, prix, features) */
    plan: EtangPlan | MagasinPlan;
    /** Status de la subscription Stripe */
    subscriptionStatus: "free" | "active" | "past_due" | "canceled";
    /** Date fin de période en cours, si subscription active */
    currentPeriodEnd: string | null;
    /** True si l'utilisateur a programmé l'annulation pour fin de période */
    cancelAtPeriodEnd: boolean;
    /** True si l'org a déjà un customer Stripe (pour eviter de re-create) */
    hasStripeCustomer: boolean;
};

/**
 * Récupère le plan actuel d'une org + les infos billing associées.
 *
 * Retourne null si l'org n'existe pas. Pour les autres erreurs (détails
 * introuvables, etc.) on fait des fallbacks safe (plan gratuit).
 */
export async function getOrgPlanInfo(
    orgId: string
): Promise<OrgPlanInfo | null> {
    const supabase = await createClient();

    const { data: org } = await supabase
        .from("organizations")
        .select(
            `id, org_type, stripe_customer_id, subscription_status,
             subscription_current_period_end, subscription_cancel_at_period_end`
        )
        .eq("id", orgId)
        .single();

    if (!org) return null;

    const baseInfo = {
        subscriptionStatus: (org.subscription_status ?? "free") as
            | "free"
            | "active"
            | "past_due"
            | "canceled",
        currentPeriodEnd: org.subscription_current_period_end as
            | string
            | null,
        cancelAtPeriodEnd: Boolean(org.subscription_cancel_at_period_end),
        hasStripeCustomer: Boolean(org.stripe_customer_id),
    };

    if (org.org_type === "etang") {
        const { data: details } = await supabase
            .from("etang_details")
            .select("plan")
            .eq("organization_id", orgId)
            .single();

        const planId = details?.plan ?? "vitrine";
        return {
            orgType: "etang",
            planId,
            plan: getEtangPlan(planId),
            ...baseInfo,
        };
    }

    if (org.org_type === "magasin") {
        const { data: details } = await supabase
            .from("magasin_details")
            .select("plan")
            .eq("organization_id", orgId)
            .single();

        const planId = details?.plan ?? "starter";
        return {
            orgType: "magasin",
            planId,
            plan: getMagasinPlan(planId),
            ...baseInfo,
        };
    }

    return null;
}