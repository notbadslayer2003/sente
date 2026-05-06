"use server";

import {getCategoriesFlat} from "@/lib/dal/product-categories";

/**
 * Wrapper server action pour fetcher la liste plate des catégories depuis un client component.
 * On ne ré-importe pas la DAL côté client (elle utilise createClient server-side avec cookies),
 * on traverse via cette server action.
 *
 * Utilisé par : NewProductButton (modale création produit)
 */
export async function getCategoriesFlatAction(): Promise<
    Array<{ id: string; label: string }>
> {
    const cats = await getCategoriesFlat();
    return cats.map((c) => ({id: c.id, label: c.label}));
}