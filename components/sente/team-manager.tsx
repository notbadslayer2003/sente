"use client";

import { useState, useTransition } from "react";
import {
    inviteTeammateAction,
    revokeInvitationAction,
    removeMemberAction,
} from "@/app/actions/invitations";

type Member = {
    membership_id: string;
    user_id: string;
    full_name: string;
    email: string;
    role: "owner" | "admin" | "staff";
    accepted_at: string | null;
};

type Invitation = {
    id: string;
    email: string;
    role: "owner" | "admin" | "staff";
    expires_at: string;
    created_at: string;
};

export function TeamManager({
                                orgId,
                                currentUserId,
                                canManage,
                                members,
                                invitations,
                            }: {
    orgId: string;
    currentUserId: string;
    canManage: boolean;
    members: Member[];
    invitations: Invitation[];
}) {
    return (
        <div className="space-y-12">
            {canManage && <InviteForm orgId={orgId} />}

            <MembersList
                orgId={orgId}
                currentUserId={currentUserId}
                canManage={canManage}
                members={members}
            />

            {invitations.length > 0 && (
                <InvitationsList
                    canManage={canManage}
                    invitations={invitations}
                />
            )}
        </div>
    );
}

function InviteForm({ orgId }: { orgId: string }) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        const fd = new FormData(e.currentTarget);
        fd.set("org_id", orgId);
        const email = fd.get("email") as string;
        const form = e.currentTarget;

        startTransition(async () => {
            const r = await inviteTeammateAction(fd);
            if (r.ok) {
                setSuccess(`Invitation envoyée à ${email}.`);
                form.reset();
                setTimeout(() => setSuccess(null), 5000);
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form
            onSubmit={onSubmit}
            className="border border-border bg-secondary/20 p-6 space-y-4"
        >
            <h2 className="font-display text-xl tracking-tight">
                Inviter un collaborateur
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                    <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Email
            </span>
                        <input
                            type="email"
                            name="email"
                            required
                            placeholder="ami@exemple.com"
                            autoComplete="off"
                            className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent"
                        />
                    </label>
                </div>
                <div className="sm:col-span-3">
                    <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Rôle
            </span>
                        <select
                            name="role"
                            defaultValue="staff"
                            className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent cursor-pointer"
                        >
                            <option value="staff">Staff</option>
                            <option value="admin">Admin</option>
                        </select>
                    </label>
                </div>
                <div className="sm:col-span-2 flex items-end">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-4 py-3 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                    >
                        {isPending ? "..." : "Inviter"}
                    </button>
                </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            {success && <p className="text-xs text-primary">{success}</p>}
        </form>
    );
}

function MembersList({
                         orgId,
                         currentUserId,
                         canManage,
                         members,
                     }: {
    orgId: string;
    currentUserId: string;
    canManage: boolean;
    members: Member[];
}) {
    return (
        <div>
            <h2 className="font-display text-xl tracking-tight mb-6">
                Membres ({members.length})
            </h2>
            {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun membre.</p>
            ) : (
                <ul className="divide-y divide-border border-y border-border">
                    {members.map((m) => (
                        <MemberRow
                            key={m.membership_id}
                            orgId={orgId}
                            currentUserId={currentUserId}
                            canManage={canManage}
                            member={m}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

function MemberRow({
                       currentUserId,
                       canManage,
                       member,
                   }: {
    orgId: string;
    currentUserId: string;
    canManage: boolean;
    member: Member;
}) {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const initials = member.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    const isMe = member.user_id === currentUserId;
    const canRemove = canManage && !isMe && member.role !== "owner";

    const onRemove = () => {
        if (!confirm(`Retirer ${member.full_name} de l'organisation ?`)) return;
        setError(null);
        const fd = new FormData();
        fd.set("membership_id", member.membership_id);
        startTransition(async () => {
            const r = await removeMemberAction(fd);
            if (!r.ok) setError(r.error);
        });
    };

    return (
        <li className="py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-10 h-10 flex items-center justify-center bg-accent/10 text-accent text-xs font-medium uppercase tracking-wide shrink-0">
                    {initials || "?"}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-display text-base leading-tight truncate">
                        {member.full_name}
                        {isMe && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                (toi)
              </span>
                        )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {member.email}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <RoleBadge role={member.role} />
                {canRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                        Retirer
                    </button>
                )}
            </div>
            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </li>
    );
}

function InvitationsList({
                             canManage,
                             invitations,
                         }: {
    canManage: boolean;
    invitations: Invitation[];
}) {
    return (
        <div>
            <h2 className="font-display text-xl tracking-tight mb-6">
                Invitations en attente ({invitations.length})
            </h2>
            <ul className="divide-y divide-border border-y border-border">
                {invitations.map((i) => (
                    <InvitationRow key={i.id} canManage={canManage} invitation={i} />
                ))}
            </ul>
        </div>
    );
}

function InvitationRow({
                           canManage,
                           invitation,
                       }: {
    canManage: boolean;
    invitation: Invitation;
}) {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onRevoke = () => {
        if (!confirm(`Révoquer l'invitation de ${invitation.email} ?`)) return;
        setError(null);
        const fd = new FormData();
        fd.set("invitation_id", invitation.id);
        startTransition(async () => {
            const r = await revokeInvitationAction(fd);
            if (!r.ok) setError(r.error);
        });
    };

    const expiresIn = Math.ceil(
        (new Date(invitation.expires_at).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );

    return (
        <li className="py-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{invitation.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Expire dans {expiresIn} jour{expiresIn > 1 ? "s" : ""}
                </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <RoleBadge role={invitation.role} />
                {canManage && (
                    <button
                        type="button"
                        onClick={onRevoke}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    >
                        Révoquer
                    </button>
                )}
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </li>
    );
}

function RoleBadge({ role }: { role: "owner" | "admin" | "staff" }) {
    const map = {
        owner: { label: "Owner", className: "bg-primary/15 text-primary" },
        admin: { label: "Admin", className: "bg-accent/15 text-accent" },
        staff: { label: "Staff", className: "bg-muted text-muted-foreground" },
    };
    const v = map[role];
    return (
        <span
            className={`px-2 py-0.5 text-[10px] uppercase tracking-wide ${v.className}`}
        >
      {v.label}
    </span>
    );
}