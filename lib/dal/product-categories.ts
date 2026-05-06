import { createClient } from "@/lib/supabase/server";

export type ProductCategoryNode = {
    id: string;
    slug: string;
    name: string;
    display_order: number;
};

export type ProductCategoryTree = {
    id: string;
    slug: string;
    name: string;
    display_order: number;
    children: ProductCategoryNode[];
};

/**
 * Retourne la taxonomie complète sous forme d'arbre (racines + sous-catégories).
 * La taxonomie est figée par Sente, donc cache-friendly.
 */
export async function getCategoryTree(): Promise<ProductCategoryTree[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("product_categories")
        .select("id, parent_id, slug, name, display_order")
        .order("display_order", { ascending: true });

    if (error || !data) {
        if (error) console.error("getCategoryTree failed:", error);
        return [];
    }

    const roots = data.filter((c) => c.parent_id === null);
    const childrenByParent = new Map<string, ProductCategoryNode[]>();
    for (const c of data) {
        if (c.parent_id === null) continue;
        const list = childrenByParent.get(c.parent_id) ?? [];
        list.push({
            id: c.id,
            slug: c.slug,
            name: c.name,
            display_order: c.display_order,
        });
        childrenByParent.set(c.parent_id, list);
    }

    return roots.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        display_order: r.display_order,
        children: childrenByParent.get(r.id) ?? [],
    }));
}

/**
 * Retourne juste la liste plate des sous-catégories (pour le select dans le ProductComposer).
 * Format : "Cannes > Cannes carpe" pour le label.
 */
export type ProductCategoryFlat = {
    id: string;
    slug: string;
    name: string;
    parent_name: string;
    label: string; // "Cannes > Cannes carpe"
};

export async function getCategoriesFlat(): Promise<ProductCategoryFlat[]> {
    const tree = await getCategoryTree();
    const flat: ProductCategoryFlat[] = [];
    for (const root of tree) {
        for (const child of root.children) {
            flat.push({
                id: child.id,
                slug: child.slug,
                name: child.name,
                parent_name: root.name,
                label: `${root.name} > ${child.name}`,
            });
        }
    }
    return flat;
}

/**
 * Récupère une catégorie par son slug (utile pour /boutique?category=cannes-carpe en V2 marketplace).
 */
export async function getCategoryBySlug(
    slug: string
): Promise<{ id: string; name: string; parent_id: string | null; parent_name: string | null } | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("product_categories")
        .select(
            "id, name, parent_id, parent:product_categories!parent_id(name)"
        )
        .eq("slug", slug)
        .maybeSingle();

    if (!data) return null;
    const parent = Array.isArray(data.parent) ? data.parent[0] : data.parent;
    return {
        id: data.id,
        name: data.name,
        parent_id: data.parent_id,
        parent_name: parent?.name ?? null,
    };
}