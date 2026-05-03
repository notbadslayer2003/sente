import { createClient } from "@/lib/supabase/server";

/**
 * Retourne le statut de follow + count pour une org donnée.
 * Si l'utilisateur n'est pas connecté, `following` est false.
 */
export async function getFollowStatus(orgId: string): Promise<{
    following: boolean;
    followers_count: number;
}> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const [{ data: org }, followQuery] = await Promise.all([
        supabase
            .from("organizations")
            .select("followers_count")
            .eq("id", orgId)
            .single(),
        user
            ? supabase
                .from("follows")
                .select("target_org_id")
                .eq("target_org_id", orgId)
                .eq("follower_user_id", user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
    ]);

    return {
        following: !!followQuery.data,
        followers_count: org?.followers_count ?? 0,
    };
}