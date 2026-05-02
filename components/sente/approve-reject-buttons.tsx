"use client";

import { useState, useTransition } from "react";
import { approveOrgAction, rejectOrgAction } from "@/app/actions/org-workflow";

export function ApproveRejectButtons({ orgId }: { orgId: string }) {
    const [error, setError] = useState<string | null>(null);
    const [showReject, setShowReject] = useState(false);
    const [reason, setReason] = useState("");
    const [isPending, startTransition] = useTransition();

    const onApprove = () => {
        setError(null);
        const fd = new FormData();
        fd.set("org_id", orgId);
        startTransition(async () => {
            const r = await approveOrgAction(fd);
            if (!r.ok) setError(r.error);
        });
    };

    const onReject = () => {
        setError(null);
        if (reason.trim().length < 10) {
            setError("Raison requise (10 caractères min)");
            return;
        }
        const fd = new FormData();
        fd.set("org_id", orgId);
        fd.set("reason", reason);
        startTransition(async () => {
            const r = await rejectOrgAction(fd);
            if (r.ok) {
                setShowReject(false);
                setReason("");
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onApprove}
                    disabled={isPending}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 text-xs uppercase tracking-wide disabled:opacity-50"
                >
                    Valider
                </button>
                <button
                    type="button"
                    onClick={() => setShowReject((s) => !s)}
                    disabled={isPending}
                    className="border border-border hover:border-destructive hover:text-destructive transition-colors px-4 py-2 text-xs uppercase tracking-wide disabled:opacity-50"
                >
                    Rejeter
                </button>
            </div>

            {showReject && (
                <div className="space-y-2">
          <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Raison du rejet (visible dans l'audit log, 10+ caractères)"
              className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-destructive"
          />
                    <button
                        type="button"
                        onClick={onReject}
                        disabled={isPending}
                        className="bg-destructive text-background hover:bg-destructive/90 transition-colors px-4 py-2 text-xs uppercase tracking-wide disabled:opacity-50"
                    >
                        Confirmer le rejet
                    </button>
                </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}