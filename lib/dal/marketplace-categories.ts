import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export type MarketplaceCategory = Database['public']['Tables']['marketplace_categories']['Row']

export type MarketplaceCategoryWithChildren = MarketplaceCategory & {
    children: MarketplaceCategory[]
}

/**
 * Liste plate de toutes les catégories N1 et N2, triées.
 * Lecture publique (RLS USING true).
 */
export async function getMarketplaceCategories(): Promise<MarketplaceCategory[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('marketplace_categories')
        .select('*')
        .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
}

/**
 * Catégories structurées en arbre N1 → enfants N2.
 * Pour menus, breadcrumbs, sélecteurs hiérarchiques.
 */
export async function getMarketplaceCategoryTree(): Promise<MarketplaceCategoryWithChildren[]> {
    const all = await getMarketplaceCategories()

    const roots = all.filter((c) => c.parent_id === null)
    const children = all.filter((c) => c.parent_id !== null)

    return roots.map((root) => ({
        ...root,
        children: children
            .filter((c) => c.parent_id === root.id)
            .sort((a, b) => a.sort_order - b.sort_order),
    }))
}

/**
 * Récupère une catégorie par son slug.
 * Retourne null si absente (jamais d'erreur).
 */
export async function getMarketplaceCategoryBySlug(
    slug: string
): Promise<MarketplaceCategory | null> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('marketplace_categories')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

    if (error) throw error
    return data
}

/**
 * Récupère une catégorie + ses enfants par slug.
 * Utile pour /marketplace/c/{slug} (page catégorie).
 */
export async function getMarketplaceCategoryWithChildren(
    slug: string
): Promise<MarketplaceCategoryWithChildren | null> {
    const category = await getMarketplaceCategoryBySlug(slug)
    if (!category) return null

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('marketplace_categories')
        .select('*')
        .eq('parent_id', category.id)
        .order('sort_order', { ascending: true })

    if (error) throw error
    return { ...category, children: data ?? [] }
}