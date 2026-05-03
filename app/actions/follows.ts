"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const FollowSchema = z.object({
    target_org_id: z.string().uuid(),
});

export async function toggleFollowAction(
    formData: FormData
): Promise<ActionResult<{ following: boolean; followers_count: number }>> {
    const parsed = FollowSchema.safeParse({
        target_org_id: formData.get("target_org_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // Existe déjà ?
    const { data: existing } = await supabase
        .from("follows")
        .select("target_org_id")
        .eq("target_org_id", parsed.data.target_org_id)
        .eq("follower_user_id", user.id)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from("follows")
            .delete()
            .eq("target_org_id", parsed.data.target_org_id)
            .eq("follower_user_id", user.id);
        if (error) {
            console.error("unfollow failed:", error);
            return { ok: false, error: "Erreur." };
        }
    } else {
        const { error } = await supabase.from("follows").insert({
            target_org_id: parsed.data.target_org_id,
            follower_user_id: user.id,
        });
        if (error) {
            console.error("follow failed:", error);
            return { ok: false, error: "Erreur." };
        }
    }

    // Compteur post-trigger
    const { data: org } = await supabase
        .from("organizations")
        .select("followers_count")
        .eq("id", parsed.data.target_org_id)
        .single();

    revalidatePath("/lieux/[slug]", "page");
    revalidatePath("/magasins/[slug]", "page");
    revalidatePath("/profil/suivis");
    revalidatePath("/feed");

    return {
        ok: true,
        data: {
            following: !existing,
            followers_count: org?.followers_count ?? 0,
        },
    };
}