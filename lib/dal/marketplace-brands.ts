import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export type MarketplaceBrand = Database['public']['Tables']['marketplace_brands']['Row']

/**
 * Liste des marques verified, triées alphabétiquement.
 * Pour autocomplete, filtres recherche, page marque.
 */
export async function getMarketplaceVerifiedBrands(): Promise<MarketplaceBrand[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('marketplace_brands')
        .select('*')
        .eq('verified', true)
        .order('name', { ascending: true })

    if (error) throw error
    return data ?? []
}

/**
 * Recherche texte sur les marques verified (autocomplete formulaire création annonce).
 * Filtre côté Postgres avec ilike pour insensibilité casse + accents.
 * Limite 10 résultats : usage typique dropdown.
 */
export async function searchMarketplaceBrands(query: string): Promise<MarketplaceBrand[]> {
    const trimmed = query.trim()
    if (trimmed.length < 1) return []

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('marketplace_brands')
        .select('*')
        .eq('verified', true)
        .ilike('name', `%${trimmed}%`)
        .order('name', { ascending: true })
        .limit(10)

    if (error) throw error
    return data ?? []
}

/**
 * Récupère une marque par slug (page marque, breadcrumb, fiche listing).
 */
export async function getMarketplaceBrandBySlug(
    slug: string
): Promise<MarketplaceBrand | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('marketplace_brands')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

    if (error) throw error
    return data
}

/**
 * Marques proposées par l'utilisateur courant (en attente validation admin).
 * Permet d'afficher "votre marque 'XYZ' est en attente de validation".
 */
export async function getMyPendingBrands(): Promise<MarketplaceBrand[]> {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
        .from('marketplace_brands')
        .select('*')
        .eq('created_by_user_id', user.id)
        .eq('verified', false)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
}