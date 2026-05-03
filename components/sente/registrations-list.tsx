"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { refundEventRegistrationAction } from "@/app/actions/event-refunds";
import { toCSV } from "@/lib/utils/csv";

type Registration = {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    payment_method: string;
    payment_status: string;
    paid_amount_cents: number;
    refunded_amount_cents: number;
    sente_commission_cents: number;
    stripe_payment_intent_id: string | null;
    notes: string | null;
    paid_at: string | null;
    refunded_at: string | null;
    refund_reason: string | null;
    created_at: string;
};

export function RegistrationsList({
                                      eventId,
                                      eventTitle,
                                      eventStatus,
                                      registrations,
                                      dashboardSlug,
                                  }: {
    eventId: string;
    eventTitle: string;
    eventStatus: string;
    registrations: Registration[];
    dashboardSlug: string;
}) {
    const onExport = () => {
        const csv = toCSV(
            registrations.map((r) => ({
                Nom: r.full_name,
                Email: r.email,
                Téléphone: r.phone ?? "",
                "Méthode paiement": labelMethod(r.payment_method),
                "Statut paiement": labelStatus(r.payment_status),
                "Montant payé (€)":
                    ((r.paid_amount_cents ?? 0) / 100).toFixed(2).replace(".", ","),
                "Montant remboursé (€)":
                    ((r.refunded_amount_cents ?? 0) / 100).toFixed(2).replace(".", ","),
                Notes: r.notes ?? "",
                "Inscrit le": new Date(r.created_at).toLocaleString("fr-BE"),
            }))
        );

        const filename = `inscriptions-${slugify(eventTitle)}-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-display text-xl tracking-tight">Inscrits</h2>
                {registrations.length > 0 && (
                    <button
                        type="button"
                        onClick={onExport}
                        className="inline-flex items-center gap-2 text-xs uppercase tracking-wide border border-border px-4 py-2 hover:bg-secondary transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" strokeWidth={2} />
                        Export CSV
                    </button>
                )}
            </div>

            {registrations.length === 0 ? (
                <div className="border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">Aucune inscription pour le moment.</p>
                </div>
            ) : (
                <ul className="divide-y divide-border border-y border-border">
                    {registrations.map((r) => (
                        <li key={r.id}>
                            <RegistrationRow
                                reg={r}
                                eventStatus={eventStatus}
                                dashboardSlug={dashboardSlug}
                                eventId={eventId}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function RegistrationRow({
                             reg,
                             eventStatus,
                         }: {
    reg: Registration;
    eventStatus: string;
    dashboardSlug: string;
    eventId: string;
}) {
    const [refundOpen, setRefundOpen] = useState(false);

    const canRefund =
        reg.payment_method === "online_card" &&
        !!reg.stripe_payment_intent_id &&
        (reg.payment_status === "paid" || reg.payment_status === "partial") &&
        (reg.paid_amount_cents - reg.refunded_amount_cents) > 0;

    return (
        <div className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-4">
                <p className="font-display text-base leading-tight">{reg.full_name}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{reg.email}</p>
                {reg.phone && <p className="text-xs text-muted-foreground mt-0.5">{reg.phone}</p>}
                {reg.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">
                        &laquo; {reg.notes} &raquo;
                    </p>
                )}
            </div>

            <div className="lg:col-span-3 text-xs">
                <p className="text-muted-foreground">{labelMethod(reg.payment_method)}</p>
                <PaymentStatusBadge status={reg.payment_status} />
                {reg.refund_reason && (
                    <p className="mt-2 text-xs text-muted-foreground italic">
                        Refund : {reg.refund_reason}
                    </p>
                )}
            </div>

            <div className="lg:col-span-3 text-xs tabular-nums">
                {reg.paid_amount_cents > 0 ? (
                    <p>
                        <span className="font-display text-base">
                            {(reg.paid_amount_cents / 100).toFixed(0)}€
                        </span>
                        {reg.refunded_amount_cents > 0 && (
                            <span className="text-destructive ml-2">
                                {" "}
                                (-{(reg.refunded_amount_cents / 100).toFixed(0)}€)
                            </span>
                        )}
                    </p>
                ) : (
                    <p className="text-muted-foreground">—</p>
                )}
                <p className="text-muted-foreground mt-1">
                    Inscrit{" "}
                    {new Date(reg.created_at).toLocaleDateString("fr-BE", {
                        day: "2-digit",
                        month: "short",
                    })}
                </p>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-2 items-end">
                {canRefund && eventStatus !== "completed" && (
                    <button
                        type="button"
                        onClick={() => setRefundOpen(!refundOpen)}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors"
                    >
                        {refundOpen ? "Annuler" : "Rembourser"}
                    </button>
                )}
            </div>

            {refundOpen && (
                <div className="lg:col-span-12">
                    <RefundForm
                        registration={reg}
                        onClose={() => setRefundOpen(false)}
                    />
                </div>
            )}
        </div>
    );
}

function RefundForm({
                        registration,
                        onClose,
                    }: {
    registration: Registration;
    onClose: () => void;
}) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const maxRefundEur =
        (registration.paid_amount_cents - registration.refunded_amount_cents) / 100;

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        fd.set("registration_id", registration.id);
        if (
            !confirm(
                "Confirmer le remboursement ? La commission Sente sera également restituée au pêcheur."
            )
        )
            return;
        startTransition(async () => {
            const r = await refundEventRegistrationAction(fd);
            if (r.ok) {
                onClose();
                router.refresh();
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form
            onSubmit={onSubmit}
            className="border border-destructive/30 bg-destructive/5 p-4 space-y-3 mt-2"
        >
            <h4 className="text-xs uppercase tracking-[0.25em] text-destructive">
                Rembourser {registration.full_name}
            </h4>

            <label className="block">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Montant (€) — max {maxRefundEur.toFixed(2)} €
        </span>
                <input
                    type="number"
                    name="refund_amount_eur"
                    step="0.01"
                    min="0.01"
                    max={maxRefundEur}
                    defaultValue={maxRefundEur.toFixed(2)}
                    required
                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-destructive"
                />
            </label>

            <label className="block">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Motif (10-1000 caractères) *
        </span>
                <textarea
                    name="reason"
                    required
                    rows={2}
                    minLength={10}
                    maxLength={1000}
                    placeholder="Ex: événement reporté, demande du pêcheur..."
                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-destructive resize-y"
                />
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-destructive text-background hover:bg-destructive/90 transition-colors px-4 py-2 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending ? "..." : "Confirmer le remboursement"}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}

function PaymentStatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; className: string }> = {
        pending: { label: "En attente", className: "bg-muted text-muted-foreground" },
        paid: { label: "Payé", className: "bg-primary/15 text-primary" },
        refunded: { label: "Remboursé", className: "bg-destructive/15 text-destructive" },
        partial: { label: "Partiel", className: "bg-accent/15 text-accent" },
        cancelled: { label: "Annulé", className: "bg-muted text-muted-foreground" },
    };
    const v = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
    return (
        <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] uppercase tracking-wide ${v.className}`}>
      {v.label}
    </span>
    );
}

function labelMethod(m: string): string {
    if (m === "online_card") return "En ligne (carte)";
    if (m === "on_site_cash") return "Espèces sur place";
    if (m === "free") return "Gratuit";
    return m;
}

function labelStatus(s: string): string {
    if (s === "paid") return "Payé";
    if (s === "pending") return "En attente";
    if (s === "refunded") return "Remboursé";
    if (s === "partial") return "Partiel";
    return s;
}

function slugify(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
}