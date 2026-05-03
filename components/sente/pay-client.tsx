"use client";

import { useState, useTransition } from "react";
import { startCheckoutAction } from "@/app/actions/payments-checkout";

export function PayClient({
                              token,
                              amountCents,
                              commissionBps,
                          }: {
    token: string;
    amountCents: number;
    commissionBps: number;
}) {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onClick = () => {
        setError(null);
        const fd = new FormData();
        fd.set("token", token);
        startTransition(async () => {
            const r = await startCheckoutAction(fd);
            if (r.ok && r.data) {
                window.location.href = r.data.url;
            } else if (!r.ok) {
                setError(r.error);
            }
        });
    };

    return (
        <div>
            <button
                type="button"
                onClick={onClick}
                disabled={isPending}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-4 text-sm font-medium tracking-wide uppercase disabled:opacity-50"
            >
                {isPending ? "Redirection..." : "Payer maintenant"}
            </button>
            {error && (
                <p className="mt-3 text-xs text-destructive text-center">{error}</p>
            )}
            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground text-center">
                Carte · Apple Pay · Google Pay (commission {(commissionBps / 100).toFixed(2)}%)
            </p>
        </div>
    );
}