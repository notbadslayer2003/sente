"use client";

import { useState, useTransition } from "react";
import { submitOrgForReviewAction } from "@/app/actions/org-workflow";

export function SubmitOrgButton({ orgId }: { orgId: string }) {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onClick = () => {
        setError(null);
        const ok = window.confirm(
            "Soumettre cette fiche à validation par l'équipe Sente ? Tu pourras continuer à l'éditer pendant la revue."
        );
        if (!ok) return;

        const fd = new FormData();
        fd.set("org_id", orgId);
        startTransition(async () => {
            const result = await submitOrgForReviewAction(fd);
            if (!result.ok) setError(result.error);
        });
    };

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={onClick}
                disabled={isPending}
                className="inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-6 py-3 text-sm font-medium tracking-wide uppercase disabled:opacity-50"
            >
                {isPending ? "Envoi..." : "Soumettre à validation"}
            </button>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}