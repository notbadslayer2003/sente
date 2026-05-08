"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markOrderAsShipped } from "@/app/actions/marketplace/mark-shipped";
import { getMyShippingLabelUrl } from "@/app/actions/marketplace/shipping-label";

// =============================================================================
// MarketplaceShipmentActions — actions seller sur la page commande
// =============================================================================
// - status='paid_awaiting_shipment' : bouton "Marquer comme expédié"
// - status='shipped' : bouton "Télécharger l'étiquette PDF"
// =============================================================================

export function MarketplaceShipmentActions({
                                               orderId,
                                               status,
                                           }: {
    orderId: string;
    status: string;
}) {
    if (status === "paid_awaiting_shipment") {
        return <MarkAsShippedAction orderId={orderId} />;
    }
    if (status === "shipped" || status === "delivered" || status === "released") {
        return <DownloadLabelAction orderId={orderId} />;
    }
    return null;
}

// -----------------------------------------------------------------------------
// Mark as shipped
// -----------------------------------------------------------------------------

function MarkAsShippedAction({ orderId }: { orderId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function handleClick() {
        if (
            !confirm(
                "Confirmer l'expédition ? Une étiquette Mondial Relay va être générée et l'acheteur sera notifié."
            )
        ) {
            return;
        }

        setError(null);
        startTransition(async () => {
            const result = await markOrderAsShipped({ orderId });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            // Reload page → status passe à 'shipped', UI bascule sur DownloadLabelAction
            router.refresh();
        });
    }

    return (
        <div className="space-y-3">
            <button
                onClick={handleClick}
                disabled={isPending}
                className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
            >
                {isPending ? "Création de l'étiquette en cours…" : "Marquer comme expédié"}
            </button>

            {isPending && (
                <p className="text-xs text-muted-foreground italic">
                    Cela peut prendre 10 à 20 secondes (génération étiquette + envoi notification).
                </p>
            )}

            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-destructive">
                        Échec
                    </p>
                    <p className="mt-1 text-xs">{error}</p>
                </div>
            )}
        </div>
    );
}

// -----------------------------------------------------------------------------
// Download label
// -----------------------------------------------------------------------------

function DownloadLabelAction({ orderId }: { orderId: string }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function handleClick() {
        setError(null);
        startTransition(async () => {
            const result = await getMyShippingLabelUrl({ orderId });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            // Ouvre la signed URL dans un nouvel onglet (download direct depuis R2)
            window.open(result.data.url, "_blank");
        });
    }

    return (
        <div className="space-y-3">
            <button
                onClick={handleClick}
                disabled={isPending}
                className="border border-accent text-accent hover:bg-accent/5 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
            >
                {isPending ? "Préparation du téléchargement…" : "Télécharger l'étiquette PDF"}
            </button>

            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}
        </div>
    );
}