"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { acceptInvitationAction } from "@/app/actions/invitations";

export function AcceptInvitationClient({ token }: { token: string }) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{
        slug: string;
        name: string;
        role: string;
    } | null>(null);
    const [isPending, startTransition] = useTransition();

    const onAccept = () => {
        setError(null);
        const fd = new FormData();
        fd.set("token", token);
        startTransition(async () => {
            const r = await acceptInvitationAction(fd);
            if (r.ok && r.data) {
                setSuccess({
                    slug: r.data.org_slug,
                    name: r.data.org_name,
                    role: r.data.role,
                });
            } else if (!r.ok) {
                setError(r.error);
            }
        });
    };

    if (success) {
        return (
            <section className="bg-background min-h-screen pt-32 pb-16">
                <div className="mx-auto max-w-md px-6 text-center space-y-6">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Invitation acceptée
                    </p>
                    <h1 className="font-display-soft text-4xl tracking-tight leading-[0.95]">
                        Bienvenue dans {success.name}.
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Tu es maintenant <strong>{success.role}</strong> de cette
                        organisation.
                    </p>
                    <Link
                        href={`/dashboard/${success.slug}`}
                        className="inline-block bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3 text-sm uppercase tracking-wide"
                    >
                        Accéder au dashboard
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-md px-6 text-center space-y-6">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Invitation Sente
                </p>
                <h1 className="font-display-soft text-4xl tracking-tight leading-[0.95]">
                    Accepter l&apos;invitation
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Tu vas rejoindre une organisation sur Sente. Clique pour confirmer.
                </p>

                {error && (
                    <div className="border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <button
                    type="button"
                    onClick={onAccept}
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3 text-sm uppercase tracking-wide disabled:opacity-50"
                >
                    {isPending ? "Acceptation..." : "Accepter l'invitation"}
                </button>

                <div>
                    <Link
                        href="/profil"
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Plus tard
                    </Link>
                </div>
            </div>
        </section>
    );
}