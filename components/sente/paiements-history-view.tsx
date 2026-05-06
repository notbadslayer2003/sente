type Payment = {
    id: string;
    kind: string;
    amount_cents: number;
    sente_commission_cents: number;
    status: string;
    created_at: string;
    reference_id: string | null;
    stripe_refund_id: string | null;
};

type Props = {
    payments: Payment[];
    stripeBalance: { available: number; pending: number } | null;
};

export function PaiementsHistoryView({ payments, stripeBalance }: Props) {
    const totalEncaisse = payments
        .filter((p) => p.kind !== "refund" && p.status === "paid")
        .reduce((sum, p) => sum + p.amount_cents, 0);

    const totalRembourse = payments
        .filter((p) => p.kind === "refund")
        .reduce((sum, p) => sum + p.amount_cents, 0);

    const totalCommission = payments.reduce((sum, p) => {
        if (p.kind === "refund") return sum - p.sente_commission_cents;
        return sum + p.sente_commission_cents;
    }, 0);

    return (
        <div className="space-y-12">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat
                    label="Encaissé"
                    value={`${(totalEncaisse / 100).toFixed(0)} €`}
                />
                <Stat
                    label="Remboursé"
                    value={`${(totalRembourse / 100).toFixed(0)} €`}
                />
                <Stat
                    label="Commission Sente"
                    value={`${(totalCommission / 100).toFixed(2)} €`}
                />
                <Stat
                    label="Solde Stripe disponible"
                    value={
                        stripeBalance
                            ? `${(stripeBalance.available / 100).toFixed(2)} €`
                            : "—"
                    }
                    sublabel={
                        stripeBalance && stripeBalance.pending > 0
                            ? `+ ${(stripeBalance.pending / 100).toFixed(2)} € en attente`
                            : undefined
                    }
                />
            </div>

            {/* Liste paiements */}
            <div>
                <h2 className="font-display text-xl tracking-tight mb-6">
                    Paiements récents
                </h2>
                {payments.length === 0 ? (
                    <div className="border border-dashed border-border p-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            Aucun paiement en ligne pour le moment.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-border border-y border-border">
                        {payments.map((p) => (
                            <li
                                key={p.id}
                                className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                            >
                                <div className="sm:col-span-3 text-xs text-muted-foreground">
                                    {new Date(p.created_at).toLocaleString("fr-BE", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </div>
                                <div className="sm:col-span-3">
                                    <KindBadge kind={p.kind} />
                                </div>
                                <div className="sm:col-span-3 text-xs text-muted-foreground truncate">
                                    {p.kind === "refund" && "Remboursement"}
                                    {p.kind === "etang_subscription" &&
                                        "Abonnement pêcheur"}
                                    {p.kind === "order" && "Commande"}
                                    {p.kind === "event_registration" && "Inscription événement"}
                                </div>
                                <div className="sm:col-span-3 text-right">
                                    <p
                                        className={`font-display text-lg ${
                                            p.kind === "refund" ? "text-destructive" : ""
                                        }`}
                                    >
                                        {p.kind === "refund" ? "−" : "+"}
                                        {(p.amount_cents / 100).toFixed(2)} €
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                                        Commission{" "}
                                        {p.kind === "refund" ? "−" : "+"}
                                        {(p.sente_commission_cents / 100).toFixed(2)} €
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function Stat({
                  label,
                  value,
                  sublabel,
              }: {
    label: string;
    value: string;
    sublabel?: string;
}) {
    return (
        <div className="border border-border bg-secondary/20 p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
            </p>
            <p className="mt-2 font-display text-2xl tracking-tight">{value}</p>
            {sublabel && (
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {sublabel}
                </p>
            )}
        </div>
    );
}

function KindBadge({ kind }: { kind: string }) {
    const map: Record<string, { label: string; className: string }> = {
        etang_subscription: {
            label: "Abonnement",
            className: "bg-primary/15 text-primary",
        },
        refund: {
            label: "Refund",
            className: "bg-destructive/15 text-destructive",
        },
        order: { label: "Commande", className: "bg-accent/15 text-accent" },
        event_registration: {
            label: "Événement",
            className: "bg-muted text-muted-foreground",
        },
        platform_fee: {
            label: "Frais",
            className: "bg-muted text-muted-foreground",
        },
    };
    const v = map[kind] ?? {
        label: kind,
        className: "bg-muted text-muted-foreground",
    };
    return (
        <span
            className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide ${v.className}`}
        >
            {v.label}
        </span>
    );
}