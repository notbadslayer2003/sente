import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import { canInviteTeamMember } from "@/lib/dal/feature-gate";
import { TeamManager } from "@/components/sente/team-manager";

type Params = Promise<{ slug: string }>;

export default async function TeamPage({ params }: { params: Params }) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    const supabase = await createClient();

    const [{ data: members, error: membersError }, { data: invitations }] =
        await Promise.all([
            supabase
                .from("memberships")
                .select(
                    `id, role, accepted_at, created_at,
                 profile:profiles!memberships_user_id_fkey(id, full_name, email, avatar_url)`
                )
                .eq("organization_id", ctx.org.id)
                .not("accepted_at", "is", null)
                .order("created_at", { ascending: true }),
            supabase
                .from("invitations")
                .select(
                    "id, email, role, expires_at, created_at, accepted_at, revoked_at"
                )
                .eq("organization_id", ctx.org.id)
                .is("accepted_at", null)
                .is("revoked_at", null)
                .gt("expires_at", new Date().toISOString())
                .order("created_at", { ascending: false }),
        ]);

    if (membersError) {
        console.error("[team] members query failed:", membersError);
    }
    const canManage = ctx.role === "owner" || ctx.role === "admin";

    // Feature gate : peut-on inviter un membre supplémentaire ?
    const inviteGate = await canInviteTeamMember(ctx.org.id);

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Configuration
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Équipe
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Invite tes collaborateurs à gérer cette organisation. Les
                    administrateurs peuvent tout faire sauf supprimer l&apos;org. Les
                    membres de l&apos;équipe peuvent éditer la fiche, les posts et le
                    registre.
                </p>
            </div>

            <TeamManager
                orgId={ctx.org.id}
                slug={ctx.org.slug}
                currentUserId={ctx.userId}
                canManage={canManage}
                canInvite={inviteGate.ok}
                inviteBlockedReason={inviteGate.ok ? null : inviteGate.reason}
                members={
                    members?.map((m) => ({
                        membership_id: m.id,
                        user_id: m.profile?.id ?? "",
                        full_name: m.profile?.full_name ?? "Sans nom",
                        email: m.profile?.email ?? "",
                        role: m.role,
                        accepted_at: m.accepted_at,
                    })) ?? []
                }
                invitations={
                    invitations?.map((i) => ({
                        id: i.id,
                        email: i.email,
                        role: i.role,
                        expires_at: i.expires_at,
                        created_at: i.created_at,
                    })) ?? []
                }
            />
        </div>
    );
}