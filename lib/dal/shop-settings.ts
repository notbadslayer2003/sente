import { createClient } from "@/lib/supabase/server";

export type ShopSettings = {
    organization_id: string;
    click_collect_enabled: boolean;
    shipping_standard_enabled: boolean;
    shipping_standard_fee_cents: number;
    shipping_local_enabled: boolean;
    shipping_local_fee_cents: number;
    shipping_local_zone_desc: string | null;
};

/**
 * Récupère la config boutique d'un magasin. Retourne null si pas encore configuré
 * (auquel cas on retombe sur les defaults dans l'UI : click&collect activé, le reste off).
 */
export async function getShopSettings(
    organizationId: string
): Promise<ShopSettings | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("shop_settings")
        .select(
            "organization_id, click_collect_enabled, shipping_standard_enabled, shipping_standard_fee_cents, shipping_local_enabled, shipping_local_fee_cents, shipping_local_zone_desc"
        )
        .eq("organization_id", organizationId)
        .maybeSingle();

    return data ?? null;
}

/**
 * Defaults appliqués quand un magasin n'a jamais configuré sa boutique.
 * Click&collect activé par défaut, frais à 0, livraison désactivée.
 */
export function getDefaultShopSettings(organizationId: string): ShopSettings {
    return {
        organization_id: organizationId,
        click_collect_enabled: true,
        shipping_standard_enabled: false,
        shipping_standard_fee_cents: 0,
        shipping_local_enabled: false,
        shipping_local_fee_cents: 0,
        shipping_local_zone_desc: null,
    };
}

/**
 * Helper combiné : retourne la config existante OU les defaults.
 * Utile pour l'UI checkout qui ne veut pas gérer le cas null.
 */
export async function getShopSettingsOrDefaults(
    organizationId: string
): Promise<ShopSettings> {
    const settings = await getShopSettings(organizationId);
    return settings ?? getDefaultShopSettings(organizationId);
}