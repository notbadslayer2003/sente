import { createClient } from "@/lib/supabase/server";
import { getOrgPlanInfo, type OrgPlanInfo } from "@/lib/dal/plan";
import {
    ETANG_PLANS,
    MAGASIN_PLANS,
    type EtangPlan,
    type MagasinPlan,
} from "@/lib/constants/plans";

/**
 * Résultat d'un check de feature.
 * - ok=true : l'action est autorisée
 * - ok=false : l'action est bloquée, avec une raison lisible et le plan
 *   suggéré pour débloquer (utilisé par les CTA upgrade)
 */
export type FeatureGateResult =
    | { ok: true; planInfo: OrgPlanInfo }
    | {
    ok: false;
    reason: string;
    /** Plan suggéré pour débloquer cette feature (null = aucun plan ne le permet) */
    requiredPlan: EtangPlan | MagasinPlan | null;
    planInfo: OrgPlanInfo;
};

// =============================================================================
// MAGASIN — produits publiés
// =============================================================================

/**
 * Vérifie si un magasin peut publier un nouveau produit (= passer un produit
 * de status draft à active). Soft cap : si déjà au-dessus de la limite,
 * blocage de toute nouvelle publication.
 */
export async function canPublishProduct(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "magasin") {
        return { ok: true, planInfo };
    }

    const limit = (planInfo.plan as MagasinPlan).limits.maxPublishedProducts;
    if (limit === Infinity) return { ok: true, planInfo };

    // Compte les produits déjà publiés
    const supabase = await createClient();
    const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "published")
        .is("deleted_at", null);

    const currentCount = count ?? 0;

    if (currentCount >= limit) {
        return {
            ok: false,
            reason: `Tu as atteint la limite de ${limit} produits publiés sur ton plan ${planInfo.plan.label}. Passe au plan supérieur pour publier sans limite.`,
            requiredPlan: MAGASIN_PLANS.pro,
            planInfo,
        };
    }
    return { ok: true, planInfo };
}

/**
 * Vérifie si un magasin peut éditer un produit existant. Soft cap activé :
 * si le magasin a downgradé et a plus de produits publiés que la limite,
 * il ne peut pas éditer (mais les produits restent publiés et visibles).
 */
export async function canEditProduct(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "magasin") {
        return { ok: true, planInfo };
    }

    const limit = (planInfo.plan as MagasinPlan).limits.maxPublishedProducts;
    if (limit === Infinity) return { ok: true, planInfo };

    const supabase = await createClient();
    const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "published")
        .is("deleted_at", null);

    const currentCount = count ?? 0;

    if (currentCount > limit) {
        return {
            ok: false,
            reason: `Tu as ${currentCount} produits publiés mais ton plan ${planInfo.plan.label} en autorise ${limit}. Réduis le nombre de produits publiés ou passe au plan supérieur.`,
            requiredPlan: MAGASIN_PLANS.pro,
            planInfo,
        };
    }
    return { ok: true, planInfo };
}

// =============================================================================
// MAGASIN — photos par produit
// =============================================================================

export async function canAddProductPhoto(args: {
    orgId: string;
    productId: string;
}): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(args.orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "magasin") {
        return { ok: true, planInfo };
    }

    const limit = (planInfo.plan as MagasinPlan).limits.maxPhotosPerProduct;
    if (limit === Infinity) return { ok: true, planInfo };

    const supabase = await createClient();
    const { data: product } = await supabase
        .from("products")
        .select("photos")
        .eq("id", args.productId)
        .single();

    if (!product) {
        return {
            ok: false,
            reason: "Produit introuvable",
            requiredPlan: null,
            planInfo,
        };
    }

    const photoCount = (product.photos as string[] | null)?.length ?? 0;
    if (photoCount >= limit) {
        return {
            ok: false,
            reason: `Ton plan ${planInfo.plan.label} permet ${limit} photo${limit > 1 ? "s" : ""} par produit. Passe au plan supérieur pour des photos illimitées.`,
            requiredPlan: MAGASIN_PLANS.pro,
            planInfo,
        };
    }
    return { ok: true, planInfo };
}

// =============================================================================
// MAGASIN — variantes multiples
// =============================================================================

/**
 * Vérifie si un magasin peut AJOUTER une variante à un produit.
 * Logique : 1 variante par produit est toujours autorisée (sinon impossible
 * de vendre). C'est l'ajout d'une 2e+ variante (pour gérer tailles/couleurs)
 * qui est réservé au plan Pro.
 */
export async function canAddVariantToProduct(args: {
    orgId: string;
    productId: string;
}): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(args.orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "magasin") {
        return { ok: true, planInfo };
    }

    const allowed = (planInfo.plan as MagasinPlan).limits.canUseVariants;
    if (allowed) return { ok: true, planInfo };

    // Plan sans variantes multiples : compte les variantes existantes du produit
    const supabase = await createClient();
    const { count } = await supabase
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("product_id", args.productId);

    const currentCount = count ?? 0;

    if (currentCount === 0) {
        // Aucune variante : on autorise la première (sinon le produit ne peut
        // pas être publié)
        return { ok: true, planInfo };
    }

    return {
        ok: false,
        reason: `Ton plan ${planInfo.plan.label} permet 1 variante par produit. Passe au plan ${MAGASIN_PLANS.pro.label} pour gérer plusieurs variantes (tailles, couleurs, etc.).`,
        requiredPlan: MAGASIN_PLANS.pro,
        planInfo,
    };
}

// =============================================================================
// MAGASIN — gestion stock
// =============================================================================

export async function canManageStock(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "magasin") {
        return { ok: true, planInfo };
    }

    const allowed = (planInfo.plan as MagasinPlan).limits.canUseStockManagement;
    if (allowed) return { ok: true, planInfo };

    return {
        ok: false,
        reason: `La gestion de stock détaillée est réservée au plan ${MAGASIN_PLANS.pro.label}.`,
        requiredPlan: MAGASIN_PLANS.pro,
        planInfo,
    };
}

// =============================================================================
// MAGASIN — analytics, promos
// =============================================================================

export async function canAccessAnalytics(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "magasin") {
        return { ok: true, planInfo };
    }

    const allowed = (planInfo.plan as MagasinPlan).limits.canAccessAnalytics;
    if (allowed) return { ok: true, planInfo };

    return {
        ok: false,
        reason: `Les analytics sont réservées au plan ${MAGASIN_PLANS.pro.label}.`,
        requiredPlan: MAGASIN_PLANS.pro,
        planInfo,
    };
}

export async function canUsePromos(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "magasin") {
        return { ok: true, planInfo };
    }

    const allowed = (planInfo.plan as MagasinPlan).limits.canUsePromos;
    if (allowed) return { ok: true, planInfo };

    return {
        ok: false,
        reason: `Les bons de réduction sont réservés au plan ${MAGASIN_PLANS.pro.label}.`,
        requiredPlan: MAGASIN_PLANS.pro,
        planInfo,
    };
}

// =============================================================================
// ÉTANG — registre, postes, paiements en ligne, exports CSV
// =============================================================================

export async function canAccessRegistre(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "etang") {
        return { ok: true, planInfo };
    }

    const allowed = (planInfo.plan as EtangPlan).limits.canAccessRegistre;
    if (allowed) return { ok: true, planInfo };

    return {
        ok: false,
        reason: `Le registre des pêcheurs est réservé au plan ${ETANG_PLANS.crm.label}.`,
        requiredPlan: ETANG_PLANS.crm,
        planInfo,
    };
}

export async function canChargeOnline(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "etang") {
        return { ok: true, planInfo };
    }

    const allowed = (planInfo.plan as EtangPlan).limits.canChargeOnline;
    if (allowed) return { ok: true, planInfo };

    return {
        ok: false,
        reason: `Les paiements en ligne sont réservés au plan ${ETANG_PLANS.crm.label}.`,
        requiredPlan: ETANG_PLANS.crm,
        planInfo,
    };
}

export async function canUsePostesAttribues(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "etang") {
        return { ok: true, planInfo };
    }

    const allowed = (planInfo.plan as EtangPlan).limits.canUsePostesAttribues;
    if (allowed) return { ok: true, planInfo };

    return {
        ok: false,
        reason: `Les postes attribués sont réservés au plan ${ETANG_PLANS.crm.label}.`,
        requiredPlan: ETANG_PLANS.crm,
        planInfo,
    };
}

export async function canUseCsvExports(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }
    if (planInfo.orgType !== "etang") {
        return { ok: true, planInfo };
    }

    const allowed = (planInfo.plan as EtangPlan).limits.canUseCsvExports;
    if (allowed) return { ok: true, planInfo };

    return {
        ok: false,
        reason: `Les exports CSV sont réservés au plan ${ETANG_PLANS.crm.label}.`,
        requiredPlan: ETANG_PLANS.crm,
        planInfo,
    };
}

// =============================================================================
// MULTI-USER (étang + magasin)
// =============================================================================

/**
 * Vérifie si l'org peut inviter un nouveau membre.
 * Compte les memberships actives (peu importe le rôle) + les invitations
 * en attente (sinon on peut bypasser en envoyant 10 invitations en parallèle).
 */
export async function canInviteTeamMember(orgId: string): Promise<FeatureGateResult> {
    const planInfo = await getOrgPlanInfo(orgId);
    if (!planInfo) {
        return {
            ok: false,
            reason: "Organisation introuvable",
            requiredPlan: null,
            planInfo: null as never,
        };
    }

    const limit =
        planInfo.orgType === "etang"
            ? (planInfo.plan as EtangPlan).limits.maxTeamMembers
            : (planInfo.plan as MagasinPlan).limits.maxTeamMembers;

    if (limit === Infinity) return { ok: true, planInfo };

    const supabase = await createClient();

    const [membersRes, invitesRes] = await Promise.all([
        supabase
            .from("memberships")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId),
        supabase
            .from("invitations")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", orgId)
            .is("accepted_at", null)
            .gt("expires_at", new Date().toISOString()),
    ]);

    const totalUsed = (membersRes.count ?? 0) + (invitesRes.count ?? 0);

    if (totalUsed >= limit) {
        const requiredPlan =
            planInfo.orgType === "etang"
                ? ETANG_PLANS.crm
                : MAGASIN_PLANS.pro;
        return {
            ok: false,
            reason: `Ton plan ${planInfo.plan.label} ne permet qu'un seul utilisateur. Passe au plan ${requiredPlan.label} pour inviter ton équipe.`,
            requiredPlan,
            planInfo,
        };
    }
    return { ok: true, planInfo };
}