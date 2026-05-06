/**
 * Source unique de vérité pour les plans Sente.
 *
 * Toute valeur affichée publiquement (pricing page, dashboard upgrade,
 * etc.) ET toute logique de feature gating (canCreateProduct, etc.)
 * doit lire depuis ce fichier — jamais de duplication ailleurs.
 *
 * Si tu changes une limite ici, le changement se propage partout.
 */

// =============================================================================
// Types
// =============================================================================

export type EtangPlanId = "vitrine" | "crm";
export type MagasinPlanId = "starter" | "pro";

export type PlanFeature = string;

export type EtangPlan = {
    id: EtangPlanId;
    label: string;
    priceCents: number; // par mois (0 si gratuit)
    period: string;
    commissionBps: number; // bps = basis points (100 = 1%)
    description: string;
    features: PlanFeature[];
    ctaLabel: string;
    highlight: boolean;
    /** Limites techniques pour feature gating */
    limits: {
        canAccessRegistre: boolean;
        canUsePostesAttribues: boolean;
        canChargeOnline: boolean;
        canUseCsvExports: boolean;
        maxTeamMembers: number; // Infinity si illimité
    };
};

export type MagasinPlan = {
    id: MagasinPlanId;
    label: string;
    priceCents: number;
    period: string;
    commissionBps: number;
    description: string;
    features: PlanFeature[];
    ctaLabel: string;
    highlight: boolean;
    limits: {
        maxPublishedProducts: number; // Infinity si illimité
        maxPhotosPerProduct: number;
        canUseVariants: boolean;
        canUseStockManagement: boolean;
        canAccessAnalytics: boolean;
        canUsePromos: boolean;
        maxTeamMembers: number;
        prioritySupport: boolean;
    };
};

// =============================================================================
// Étangs
// =============================================================================

export const ETANG_PLANS: Record<EtangPlanId, EtangPlan> = {
    vitrine: {
        id: "vitrine",
        label: "Vitrine",
        priceCents: 0,
        period: "toujours",
        commissionBps: 0,
        description:
            "Présence dans l'annuaire, posts, événements, commentaires. Sans limite.",
        features: [
            "Fiche étang complète",
            "Posts et événements illimités",
            "Suiveurs et notifications",
            "Modération incluse",
        ],
        ctaLabel: "Créer un compte gratuit",
        highlight: false,
        limits: {
            canAccessRegistre: false,
            canUsePostesAttribues: false,
            canChargeOnline: false,
            canUseCsvExports: false,
            maxTeamMembers: 1,
        },
    },
    crm: {
        id: "crm",
        label: "Dashboard CRM",
        priceCents: 2900,
        period: "par mois",
        commissionBps: 300,
        description:
            "Pour gérer vos pêcheurs annuels et longue durée. Plus 3 % sur paiements en ligne.",
        features: [
            "Registre des pêcheurs annuels",
            "Postes attribués (optionnel)",
            "Paiements en ligne via Stripe",
            "Exports comptables CSV",
            "Multi-utilisateurs (équipe)",
        ],
        ctaLabel: "Activer le dashboard",
        highlight: true,
        limits: {
            canAccessRegistre: true,
            canUsePostesAttribues: true,
            canChargeOnline: true,
            canUseCsvExports: true,
            maxTeamMembers: Infinity,
        },
    },
} as const;

export const ETANG_PLANS_LIST: EtangPlan[] = [
    ETANG_PLANS.vitrine,
    ETANG_PLANS.crm,
];

// =============================================================================
// Magasins
// =============================================================================

export const MAGASIN_PLANS: Record<MagasinPlanId, MagasinPlan> = {
    starter: {
        id: "starter",
        label: "Starter",
        priceCents: 0,
        period: "par mois",
        commissionBps: 500,
        description:
            "Pour démarrer sans engagement. Commission 5 % sur les ventes.",
        features: [
            "Boutique en ligne intégrée",
            "Jusqu'à 20 produits publiés",
            "1 photo par produit",
            "Posts et présence vitrine",
            "Encaissement Stripe Connect",
        ],
        ctaLabel: "Démarrer gratuitement",
        highlight: false,
        limits: {
            maxPublishedProducts: 20,
            maxPhotosPerProduct: 1,
            canUseVariants: false,
            canUseStockManagement: false,
            canAccessAnalytics: false,
            canUsePromos: false,
            maxTeamMembers: 1,
            prioritySupport: false,
        },
    },
    pro: {
        id: "pro",
        label: "Pro",
        priceCents: 4900,
        period: "par mois",
        commissionBps: 200,
        description:
            "Pour les magasins qui scalent. Commission 2 % sur les ventes.",
        features: [
            "Catalogue produits illimité",
            "Photos illimitées par produit",
            "Variantes et gestion de stock",
            "Analytics ventes et trafic",
            "Bons promo trackés",
            "Multi-utilisateurs (équipe)",
            "Support prioritaire",
        ],
        ctaLabel: "Choisir Pro",
        highlight: true,
        limits: {
            maxPublishedProducts: Infinity,
            maxPhotosPerProduct: Infinity,
            canUseVariants: true,
            canUseStockManagement: true,
            canAccessAnalytics: true,
            canUsePromos: true,
            maxTeamMembers: Infinity,
            prioritySupport: true,
        },
    },
} as const;

export const MAGASIN_PLANS_LIST: MagasinPlan[] = [
    MAGASIN_PLANS.starter,
    MAGASIN_PLANS.pro,
];

// =============================================================================
// Helpers de formatage
// =============================================================================

/**
 * Formate un montant en cents en string "29€" ou "0€".
 * Utilisé sur la page pricing (sans décimales pour les plans ronds).
 */
export function formatPlanPrice(cents: number): string {
    if (cents === 0) return "0€";
    return `${(cents / 100).toFixed(0)}€`;
}

/**
 * Formate un commission BPS en string "2%" ou "2,5%".
 */
export function formatCommissionBps(bps: number): string {
    const pct = bps / 100;
    if (pct === Math.floor(pct)) return `${pct}%`;
    return `${pct.toFixed(1).replace(".", ",")}%`;
}

// =============================================================================
// Helpers de feature gating (utilisés plus tard)
// =============================================================================

/**
 * Retourne le plan d'un magasin par son id.
 * Si l'id est inconnu, fallback sur Starter (defense in depth).
 */
export function getMagasinPlan(planId: string | null | undefined): MagasinPlan {
    if (!planId) return MAGASIN_PLANS.starter;
    return MAGASIN_PLANS[planId as MagasinPlanId] ?? MAGASIN_PLANS.starter;
}

/**
 * Retourne le plan d'un étang par son id.
 */
export function getEtangPlan(planId: string | null | undefined): EtangPlan {
    if (!planId) return ETANG_PLANS.vitrine;
    return ETANG_PLANS[planId as EtangPlanId] ?? ETANG_PLANS.vitrine;
}