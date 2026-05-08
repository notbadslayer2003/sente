"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmOrderReceived } from "@/app/actions/marketplace/confirm-received";

export function MarketplaceConfirmReceivedButton({ orderId }: { orderId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function handleClick() {
        if (
            !confirm(
                "Confirmer que tu as bien reçu ton colis ? Le vendeur sera notifié et le paiement lui sera transféré sous 48h."
            )
        ) {
            return;
        }

        setError(null);
        startTransition(async () => {
            const result = await confirmOrderReceived({ orderId });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            router.refresh();
        });
    }

    return (
        <div className="space-y-3">
            <button
                onClick={handleClick}
                disabled={isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
            >
                {isPending ? "Confirmation…" : "J'ai bien reçu mon colis"}
            </button>

            <p className="text-xs text-muted-foreground italic">
                Sans confirmation de ta part, la commande sera automatiquement marquée comme livrée 10 jours après l'expédition.
            </p>

            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}
        </div>
    );
}