"use client";

import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import {
    markOrderPreparingAction,
    markOrderReadyForPickupAction,
    markOrderShippedAction,
    markOrderDeliveredAction,
    cancelOrderAsMagasinAction,
} from "@/app/actions/order-transitions";
import {TRACKING_CARRIERS} from "@/lib/utils/tracking-links";
import type {OrderDetail} from "@/lib/dal/orders";

type Props = {
    slug: string;
    order: OrderDetail;
};

export function OrderTransitionPanel({order}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [showShipForm, setShowShipForm] = useState(false);
    const [showCancelForm, setShowCancelForm] = useState(false);

    const callAction = (
        actionFn: (fd: FormData) => Promise<
            { ok: true; data?: undefined } | { ok: false; error: string }
        >,
        fd: FormData,
        confirmMsg?: string
    ) => {
        if (confirmMsg && !confirm(confirmMsg)) return;
        startTransition(async () => {
            setError(null);
            const r = await actionFn(fd);
            if (r.ok) {
                router.refresh();
            } else {
                setError(r.error);
            }
        });
    };

    const onPreparing = () => {
        const fd = new FormData();
        fd.set("order_id", order.id);
        callAction(markOrderPreparingAction, fd);
    };

    const onReadyForPickup = () => {
        const fd = new FormData();
        fd.set("order_id", order.id);
        callAction(
            markOrderReadyForPickupAction,
            fd,
            "Marquer cette commande comme prête à retirer ? Le client recevra un email."
        );
    };

    const onDelivered = () => {
        const fd = new FormData();
        fd.set("order_id", order.id);
        callAction(
            markOrderDeliveredAction,
            fd,
            "Marquer cette commande comme livrée ?"
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render selon statut
    // ─────────────────────────────────────────────────────────────────────────

    if (order.status === "paid") {
        return (
            <div className="border border-border p-5 space-y-3">
                <p className="text-sm">
                    Cette commande attend ta préparation.
                </p>
                <button
                    type="button"
                    onClick={onPreparing}
                    disabled={isPending}
                    className="w-full px-4 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                    {isPending ? "..." : "Marquer en préparation"}
                </button>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <CancelButton
                    showForm={showCancelForm}
                    setShowForm={setShowCancelForm}
                    orderId={order.id}
                />
            </div>
        );
    }

    if (order.status === "preparing") {
        return (
            <div className="border border-border p-5 space-y-3">
                {order.delivery_method === "click_collect" ? (
                    <>
                        <p className="text-sm">
                            Quand le client peut venir retirer la commande, marque-la
                            comme prête. Il recevra un email.
                        </p>
                        <button
                            type="button"
                            onClick={onReadyForPickup}
                            disabled={isPending}
                            className="w-full px-4 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                        >
                            {isPending ? "..." : "Marquer prête à retirer"}
                        </button>
                    </>
                ) : (
                    <>
                        {showShipForm ? (
                            <ShipForm
                                orderId={order.id}
                                onCancel={() => setShowShipForm(false)}
                                onSent={() => router.refresh()}
                            />
                        ) : (
                            <>
                                <p className="text-sm">
                                    Quand tu confies le colis au transporteur, renseigne
                                    le tracking. Le client recevra un email avec le suivi.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowShipForm(true)}
                                    disabled={isPending}
                                    className="w-full px-4 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                                >
                                    Marquer expédiée
                                </button>
                            </>
                        )}
                    </>
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}
                <CancelButton
                    showForm={showCancelForm}
                    setShowForm={setShowCancelForm}
                    orderId={order.id}
                />
            </div>
        );
    }

    if (order.status === "ready_for_pickup" || order.status === "shipped") {
        return (
            <div className="border border-border p-5 space-y-3">
                <p className="text-sm">
                    {order.status === "ready_for_pickup"
                        ? "Quand le client a retiré la commande, marque-la comme livrée."
                        : "Quand tu as la confirmation que le colis est arrivé, marque la commande comme livrée."}
                </p>
                <button
                    type="button"
                    onClick={onDelivered}
                    disabled={isPending}
                    className="w-full px-4 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-50"
                >
                    {isPending ? "..." : "Marquer livrée"}
                </button>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <CancelButton
                    showForm={showCancelForm}
                    setShowForm={setShowCancelForm}
                    orderId={order.id}
                />
            </div>
        );
    }

    if (order.status === "delivered") {
        return (
            <div className="border border-border p-5">
                <p className="text-sm text-muted-foreground">
                    Cette commande est terminée. Pour un remboursement, utilise la
                    section refunds (à venir).
                </p>
            </div>
        );
    }

    // cancelled / refunded / disputed / pending_payment
    return (
        <div className="border border-border p-5">
            <p className="text-sm text-muted-foreground">
                Aucune action disponible à ce stade.
            </p>
        </div>
    );
}

// =============================================================================
// Form expédition
// =============================================================================

function ShipForm({
                      orderId,
                      onCancel,
                      onSent,
                  }: {
    orderId: string;
    onCancel: () => void;
    onSent: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [carrier, setCarrier] = useState("bpost");
    const [trackingNumber, setTrackingNumber] = useState("");

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const fd = new FormData();
        fd.set("order_id", orderId);
        fd.set("tracking_carrier", carrier);
        fd.set("tracking_number", trackingNumber.trim());

        startTransition(async () => {
            const r = await markOrderShippedAction(fd);
            if (r.ok) onSent();
            else setError(r.error);
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-3">
            <div>
                <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Transporteur
                    </span>
                    <select
                        value={carrier}
                        onChange={(e) => setCarrier(e.target.value)}
                        disabled={isPending}
                        className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm cursor-pointer focus:border-accent focus:outline-none"
                    >
                        {TRACKING_CARRIERS.map((c) => (
                            <option key={c.value} value={c.value}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div>
                <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Numéro de tracking
                    </span>
                    <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        required
                        minLength={3}
                        maxLength={100}
                        placeholder="ex: BE123456789"
                        disabled={isPending}
                        className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none"
                    />
                </label>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending || trackingNumber.trim().length === 0}
                    className="flex-1 px-4 py-2 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                    {isPending ? "..." : "Confirmer expédition"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isPending}
                    className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}

// =============================================================================
// Bouton annulation (avec form raison)
// =============================================================================

function CancelButton({
                          showForm,
                          setShowForm,
                          orderId,
                      }: {
    showForm: boolean;
    setShowForm: (v: boolean) => void;
    orderId: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [reason, setReason] = useState("");

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const fd = new FormData();
        fd.set("order_id", orderId);
        fd.set("reason", reason.trim());

        startTransition(async () => {
            const r = await cancelOrderAsMagasinAction(fd);
            if (r.ok) {
                setShowForm(false);
                setReason("");
                router.refresh();
            } else {
                setError(r.error);
            }
        });
    };

    if (!showForm) {
        return (
            <button
                type="button"
                onClick={() => setShowForm(true)}
                className="w-full text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors pt-2"
            >
                Annuler la commande
            </button>
        );
    }

    return (
        <form
            onSubmit={onSubmit}
            className="space-y-3 pt-3 border-t border-border"
        >
            <p className="text-xs text-muted-foreground">
                Annule la commande et restaure le stock. Pour rembourser le client,
                utilise la section refunds après annulation.
            </p>
            <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                minLength={10}
                maxLength={1000}
                required
                placeholder="Raison de l'annulation (visible par le client)..."
                disabled={isPending}
                className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isPending || reason.trim().length < 10}
                    className="flex-1 px-4 py-2 text-xs uppercase tracking-wide bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                    {isPending ? "..." : "Confirmer l'annulation"}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setShowForm(false);
                        setReason("");
                    }}
                    disabled={isPending}
                    className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Retour
                </button>
            </div>
        </form>
    );
}