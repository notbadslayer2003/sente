import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type MarketplaceSellerAccount =
    Database["public"]["Tables"]["marketplace_seller_accounts"]["Row"];

export type MarketplaceKycStatus =
    Database["public"]["Enums"]["marketplace_kyc_status"];

/**
 * Récupère le compte vendeur de l'utilisateur courant.
 * Retourne null s'il n'a jamais initié de KYC.
 */
export async function getMyMarketplaceSellerAccount(): Promise<MarketplaceSellerAccount | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from("marketplace_seller_accounts")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * Vrai si l'utilisateur courant est vendeur vérifié et capable d'encaisser.
 * Wrapper Postgres-side via fn_marketplace_is_seller_verified, sécurisé.
 */
export async function isMyMarketplaceSellerVerified(): Promise<boolean> {
    const account = await getMyMarketplaceSellerAccount();
    return (
        account?.kyc_status === "verified" &&
        account.stripe_charges_enabled === true &&
        account.stripe_payouts_enabled === true
    );
}

/**
 * Récupère un compte vendeur par son user_id.
 * Pour usage côté webhook ou admin (à appeler avec admin client si bypass RLS nécessaire).
 */
export async function getMarketplaceSellerAccountByUserId(
    userId: string
): Promise<MarketplaceSellerAccount | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("marketplace_seller_accounts")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) throw error;
    return data;
}