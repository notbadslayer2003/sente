import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { Database } from "@/lib/database.types";

type OrgType = Database["public"]["Enums"]["org_type"];
type OrgStatus = Database["public"]["Enums"]["org_status"];
type MemberRole = Database["public"]["Enums"]["member_role"];

export type DashboardContext = {
    org: {
        id: string;
        slug: string;
        name: string;
        org_type: OrgType;
        status: OrgStatus;
        owner_user_id: string;
    };
    role: MemberRole;
    userId: string;
};

/**
 * Charge l'org par slug + vérifie que l'utilisateur connecté en est membre.
 * Redirige vers /login si non connecté, /profil si pas membre, 404 si org inexistante.
 */
export async function getDashboardContext(slug: string): Promise<DashboardContext> {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: org } = await supabase
        .from("organizations")
        .select("id, slug, name, org_type, status, owner_user_id")
        .eq("slug", slug)
        .is("deleted_at", null)
        .single();

    if (!org) notFound();

    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();

    if (!membership) redirect("/profil");

    return { org, role: membership.role, userId: user.id };
}