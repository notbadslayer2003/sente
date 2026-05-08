import { createClient } from "@/lib/supabase/server";

// =============================================================================
// DAL : marketplace_addresses
// =============================================================================

export type MarketplaceAddress = {
    id: string;
    user_id: string;
    full_name: string;
    line1: string;
    line2: string;
    postal_code: string;
    city: string;
    country: "BE" | "FR";
    phone: string;
    label: string;
    is_default: boolean;
    created_at: string;
    updated_at: string;
};

/**
 * Liste les adresses du user courant.
 * Triées : default en haut puis par date desc.
 */
export async function getMyAddresses(): Promise<MarketplaceAddress[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from("marketplace_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as MarketplaceAddress[];
}

/**
 * Récupère une adresse par id si appartenant au user courant.
 */
export async function getMyAddressById(
    id: string
): Promise<MarketplaceAddress | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from("marketplace_addresses")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) throw error;
    return data as MarketplaceAddress | null;
}