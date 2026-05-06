"use server";

import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {generateInvitationToken, hashToken} from "@/lib/utils/token";
import {getResendClient} from "@/lib/email/client";
import {buildInvitationEmail} from "@/lib/email/templates/invitation";
import { canInviteTeamMember } from "@/lib/dal/feature-gate";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const InviteSchema = z.object({
    org_id: z.string().uuid(),
    email: z.string().email("Email invalide").max(200),
    role: z.enum(["admin", "staff"]),
});

export async function inviteTeammateAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = InviteSchema.safeParse({
        org_id: formData.get("org_id"),
        email: formData.get("email"),
        role: formData.get("role"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Champs invalides",
        };
    }

    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();
    if (!user) return {ok: false, error: "Non authentifié"};

    // Feature gate : multi-user réservé aux plans payants
    const gate = await canInviteTeamMember(parsed.data.org_id);
    if (!gate.ok) {
        return { ok: false, error: gate.reason };
    }

    // 1. Génère le token clair + le hash
    const tokenClair = generateInvitationToken();
    const tokenHash = hashToken(tokenClair);

    // 2. Crée l'invitation via la RPC (tous les checks sécu sont dedans)
    const {error: rpcError} = await supabase.rpc("create_invitation", {
        p_org_id: parsed.data.org_id,
        p_email: parsed.data.email,
        p_role: parsed.data.role,
        p_token_hash: tokenHash,
    });

    if (rpcError) {
        console.error("create_invitation failed:", rpcError);
        return {ok: false, error: humanizeInvitationError(rpcError.message)};
    }

    // 3. Récupère le nom de l'inviteur + le nom de l'org pour l'email
    const [{data: profile}, {data: org}] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase
            .from("organizations")
            .select("name")
            .eq("id", parsed.data.org_id)
            .single(),
    ]);

    const inviterName = profile?.full_name ?? user.email ?? "Quelqu'un";
    const orgName = org?.name ?? "une organisation";

    // 4. Envoie l'email Resend
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const acceptUrl = `${baseUrl}/invitations/${tokenClair}`;

    const {text, html} = buildInvitationEmail({
        inviterName,
        orgName,
        role: parsed.data.role,
        acceptUrl,
        expiresInDays: 14,
    });

    try {
        const resend = getResendClient();
        await resend.emails.send({
            from: "Sente <notifications@lasente.eu>",
            to: [parsed.data.email],
            subject: `Tu es invité·e à rejoindre ${orgName} sur Sente`,
            text,
            html,
        });
    } catch (err) {
        console.error("Resend email failed:", err);
        // L'invitation est créée en DB mais l'email a échoué.
        // On ne fait pas rollback : l'admin peut renvoyer le lien manuellement.
        return {
            ok: false,
            error:
                "Invitation créée mais l'email n'a pas pu être envoyé. Tu peux renvoyer le lien depuis la liste.",
        };
    }

    revalidatePath("/dashboard/[slug]/equipe", "page");
    return {ok: true};
}

const RevokeSchema = z.object({
    invitation_id: z.string().uuid(),
});

export async function revokeInvitationAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RevokeSchema.safeParse({
        invitation_id: formData.get("invitation_id"),
    });
    if (!parsed.success) return {ok: false, error: "Paramètres invalides"};

    const supabase = await createClient();
    const {error} = await supabase.rpc("revoke_invitation", {
        p_invitation_id: parsed.data.invitation_id,
    });

    if (error) {
        console.error("revoke_invitation failed:", error);
        return {ok: false, error: humanizeInvitationError(error.message)};
    }

    revalidatePath("/dashboard/[slug]/equipe", "page");
    return {ok: true};
}

const RemoveMemberSchema = z.object({
    membership_id: z.string().uuid(),
});

export async function removeMemberAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RemoveMemberSchema.safeParse({
        membership_id: formData.get("membership_id"),
    });
    if (!parsed.success) return {ok: false, error: "Paramètres invalides"};

    const supabase = await createClient();
    const {error} = await supabase.rpc("remove_member", {
        p_membership_id: parsed.data.membership_id,
    });

    if (error) {
        console.error("remove_member failed:", error);
        return {ok: false, error: humanizeInvitationError(error.message)};
    }

    revalidatePath("/dashboard/[slug]/equipe", "page");
    return {ok: true};
}

const AcceptSchema = z.object({
    token: z.string().length(64, "Token invalide"),
});

export async function acceptInvitationAction(
    formData: FormData
): Promise<
    ActionResult<{ org_slug: string; org_name: string; role: string }>
> {
    const parsed = AcceptSchema.safeParse({token: formData.get("token")});
    if (!parsed.success) return {ok: false, error: "Token invalide"};

    const tokenHash = hashToken(parsed.data.token);

    const supabase = await createClient();
    const {data, error} = await supabase
        .rpc("accept_invitation", {p_token_hash: tokenHash})
        .single();

    if (error) {
        console.error("accept_invitation failed:", error);
        return {ok: false, error: humanizeInvitationError(error.message)};
    }

    if (!data) return {ok: false, error: "Erreur inattendue"};

    revalidatePath("/profil");
    revalidatePath("/dashboard/[slug]", "page");
    return {
        ok: true,
        data: {
            org_slug: data.organization_slug,
            org_name: data.organization_name,
            role: data.member_role,
        },
    };
}

function humanizeInvitationError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("déjà membre"))
        return "Cette personne est déjà membre.";
    if (lower.includes("déjà en attente"))
        return "Une invitation est déjà en cours pour cet email.";
    if (lower.includes("déjà été utilisée"))
        return "Cette invitation a déjà été utilisée.";
    if (lower.includes("révoquée")) return "Cette invitation a été révoquée.";
    if (lower.includes("expiré")) return "Cette invitation a expiré.";
    if (lower.includes("autre email"))
        return "Cette invitation est destinée à un autre email. Connecte-toi avec l'email qui a reçu l'invitation.";
    if (lower.includes("trop de tentatives"))
        return "Trop de tentatives sur cette invitation.";
    if (lower.includes("introuvable"))
        return "Invitation introuvable ou invalide.";
    if (lower.includes("owner ne peut pas"))
        return "L'owner ne peut pas être retiré. Transfère la propriété d'abord.";
    if (lower.includes("inviter un nouvel owner"))
        return "Impossible d'inviter un autre owner.";
    if (lower.includes("accès refusé")) return "Accès refusé.";
    return msg;
}