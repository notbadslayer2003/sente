"use server";

import {createClient} from "@/lib/supabase/server";
import {z} from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const SearchSchema = z.object({
    query: z.string().min(1).max(100),
});

export async function searchOrgsAction(
    formData: FormData
): Promise<
    ActionResult<{
        results: Array<{
            id: string;
            slug: string;
            name: string;
            org_type: string;
            city: string | null;
        }>;
    }>
> {
    const parsed = SearchSchema.safeParse({
        query: formData.get("query"),
    });
    if (!parsed.success) return {ok: false, error: "Requête invalide"};

    const supabase = await createClient();
    const {data, error} = await supabase
        .from("organizations")
        .select("id, slug, name, org_type, city")
        .ilike("name", `%${parsed.data.query}%`)
        .eq("status", "active")
        .is("deleted_at", null)
        .order("name", {ascending: true})
        .limit(8);

    if (error) {
        console.error("searchOrgs failed:", error);
        return {ok: false, error: "Erreur de recherche."};
    }

    return {ok: true, data: {results: data ?? []}};
}