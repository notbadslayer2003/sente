"use client";

import { useTransition } from "react";
import { createCustomerPortalAction } from "@/app/actions/subscription";

type Props = {
    orgId: string;
    label?: string;
    variant?: "default" | "subtle";
};

export function CustomerPortalButton({
                                         orgId,
                                         label = "Ouvrir le portail Stripe",
                                         variant = "default",
                                     }: Props) {
    const [isPending, startTransition] = useTransition();

    const onClick = () => {
        const fd = new FormData();
        fd.set("org_id", orgId);
        startTransition(async () => {
            const r = await createCustomerPortalAction(fd);
            if (r.ok && r.data?.url) {
                window.location.href = r.data.url;
            } else {
                alert(r.ok ? "Erreur inconnue" : r.error);
            }
        });
    };

    const className =
        variant === "subtle"
            ? "text-xs uppercase tracking-wide border border-border px-4 py-2 hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-50 shrink-0"
            : "text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 disabled:opacity-50 shrink-0";

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isPending}
            className={className}
        >
            {isPending ? "Ouverture..." : label}
        </button>
    );
}