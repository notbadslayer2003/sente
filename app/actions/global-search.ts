"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const SearchSchema = z.object({
    query: z.string().min(1).max(100),
});

export type GlobalSearchResult = {
    id: string;
    slug: string;
    name: string;
    org_type: "etang" | "magasin";
    city: string | null;
    cover_image_url: string | null;
};

export async function globalSearchAction(
    formData: FormData
): Promise<ActionResult<{ results: GlobalSearchResult[] }>> {
    const parsed = SearchSchema.safeParse({
        query: formData.get("query"),
    });
    if (!parsed.success) return { ok: false, error: "Requête invalide" };

    const supabase = await createClient();
    const q = parsed.data.query.trim();

    // Recherche : nom OU ville (LIKE insensible) + filtre status actif
    const { data, error } = await supabase
        .from("organizations")
        .select("id, slug, name, org_type, city, cover_image_url")
        .eq("status", "active")
        .is("deleted_at", null)
        .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
        .order("name", { ascending: true })
        .limit(10);

    if (error) {
        console.error("globalSearch failed:", error);
        return { ok: false, error: "Erreur de recherche." };
    }

    return {
        ok: true,
        data: {
            results: (data ?? []).map((r) => ({
                id: r.id,
                slug: r.slug,
                name: r.name,
                org_type: r.org_type as "etang" | "magasin",
                city: r.city,
                cover_image_url: r.cover_image_url,
            })),
        },
    };
}