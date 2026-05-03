"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const RemoveSchema = z.object({
    post_id: z.string().uuid(),
    organization_id: z.string().uuid(),
});

export async function removeOrgMentionAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RemoveSchema.safeParse({
        post_id: formData.get("post_id"),
        organization_id: formData.get("organization_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_org_mention", {
        p_post_id: parsed.data.post_id,
        p_organization_id: parsed.data.organization_id,
    });
    if (error) {
        console.error("remove_org_mention failed:", error);
        return { ok: false, error: "Action refusée." };
    }

    revalidatePath("/dashboard/[slug]/mentions", "page");
    revalidatePath("/feed");
    return { ok: true };
}