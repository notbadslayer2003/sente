"use client";

import Link from "next/link";
import type {OrderDetail} from "@/lib/dal/orders";
import {formatPriceEur} from "@/lib/utils/format";
import {carrierLabel, buildTrackingUrl} from "@/lib/utils/tracking-links";
import {OrderTransitionPanel} from "@/components/sente/order-transition-panel";
import { OrderRefundPanel } from "@/components/sente/order-refund-panel";

type Props = {
    slug: string;
    order: OrderDetail;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    pending_payment: {
        label: "Paiement en cours",
        className: "bg-muted text-muted-foreground",
    },
    paid: {label: "À préparer", className: "bg-accent/15 text-accent"},
    preparing: {label: "En préparation", className: "bg-accent/15 text-accent"},
    ready_for_pickup: {
        label: "Prête à retirer",
        className: "bg-primary/15 text-primary",
    },
    shipped: {label: "Expédiée", className: "bg-primary/15 text-primary"},
    delivered: {label: "Livrée", className: "bg-secondary text-foreground"},
    cancelled: {
        label: "Annulée",
        className: "bg-destructive/15 text-destructive",
    },
    refunded: {
        label: "Remboursée",
        className: "bg-destructive/15 text-destructive",
    },
    disputed: {
        label: "Litige",
        className: "bg-destructive/15 text-destructive",
    },
};

const DELIVERY_LABELS: Record<string, string> = {
    click_collect: "Retrait en magasin",
    shipping_standard: "Livraison standard",
    shipping_local: "Livraison locale",
};

export function OrderDetailView({slug, order}: Props) {
    const orderShort = order.id.slice(0, 8).toUpperCase();
    const status = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending_payment;

    return (
        <div className="space-y-8">
            {/* Header */}
            <header className="flex items-start justify-between flex-wrap gap-4 pb-6 border-b border-border">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Commande
                    </p>
                    <h1 className="mt-2 font-display text-3xl tracking-tight font-mono">
                        #{orderShort}
                    </h1>
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                        <span
                            className={`px-2 py-0.5 text-[10px] uppercase tracking-wide ${status.className}`}
                        >
                            {status.label}
                        </span>
                        {order.delivery_method && (
                            <span className="text-xs text-muted-foreground">
                                {DELIVERY_LABELS[order.delivery_method]}
                            </span>
                        )}
                        {order.paid_at && (
                            <span className="text-xs text-muted-foreground">
                                · Payée le{" "}
                                {new Date(order.paid_at).toLocaleDateString("fr-BE", {
                                    day: "2-digit",
                                    month: "long",
                                    year: "numeric",
                                })}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* Layout 2 colonnes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Colonne gauche : items + customer + adresse */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Items */}
                    <Section title="Articles">
                        <div className="border border-border">
                            <table className="w-full">
                                <thead>
                                <tr className="border-b border-border bg-secondary/20">
                                    <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                        Produit
                                    </th>
                                    <th className="text-left p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal hidden sm:table-cell">
                                        SKU
                                    </th>
                                    <th className="text-right p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                        Qté
                                    </th>
                                    <th className="text-right p-3 text-[10px] uppercase tracking-wide text-muted-foreground font-normal">
                                        Total
                                    </th>
                                </tr>
                                </thead>
                                <tbody>
                                {order.items.map((item) => (
                                    <tr
                                        key={item.id}
                                        className="border-b border-border last:border-0"
                                    >
                                        <td className="p-3">
                                            <p className="text-sm font-medium">
                                                {item.product_name}
                                            </p>
                                            {item.variant_name && (
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {item.variant_name}
                                                </p>
                                            )}
                                            {item.refunded_quantity > 0 && (
                                                <p className="text-[10px] uppercase tracking-wide text-destructive mt-1">
                                                    {item.refunded_quantity} remboursé
                                                    {item.refunded_quantity > 1 ? "s" : ""}
                                                </p>
                                            )}
                                        </td>
                                        <td className="p-3 text-xs text-muted-foreground font-mono hidden sm:table-cell">
                                            {item.sku ?? "—"}
                                        </td>
                                        <td className="p-3 text-right text-sm tabular-nums">
                                            {item.quantity}
                                        </td>
                                        <td className="p-3 text-right text-sm font-medium tabular-nums whitespace-nowrap">
                                            {formatPriceEur(item.line_total_cents, {
                                                showFree: false,
                                            })}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </Section>

                    {/* Customer */}
                    <Section title="Client">
                        <div className="border border-border p-5 space-y-2">
                            <Row
                                label="Nom"
                                value={order.customer_name ?? "—"}
                            />
                            <Row
                                label="Email"
                                value={
                                    order.customer_email ? (
                                        <a
                                            href={`mailto:${order.customer_email}`}
                                            className="hover:text-accent transition-colors"
                                        >
                                            {order.customer_email}
                                        </a>
                                    ) : (
                                        "—"
                                    )
                                }
                            />
                            <Row
                                label="Téléphone"
                                value={
                                    order.customer_phone ? (
                                        <a
                                            href={`tel:${order.customer_phone.replace(/\s/g, "")}`}
                                            className="hover:text-accent transition-colors"
                                        >
                                            {order.customer_phone}
                                        </a>
                                    ) : (
                                        "—"
                                    )
                                }
                            />
                        </div>
                    </Section>

                    {/* Adresse de livraison (si applicable) */}
                    {order.delivery_method !== "click_collect" &&
                        order.shipping_address && (
                            <Section title="Adresse de livraison">
                                <ShippingAddressBlock address={order.shipping_address}/>
                            </Section>
                        )}

                    {/* Tracking (si shipped) */}
                    {order.tracking_carrier && order.tracking_number && (
                        <Section title="Suivi du colis">
                            <div className="border border-border p-5 space-y-2">
                                <Row
                                    label="Transporteur"
                                    value={carrierLabel(order.tracking_carrier)}
                                />
                                <Row
                                    label="Numéro"
                                    value={
                                        <span className="font-mono">
                                            {order.tracking_number}
                                        </span>
                                    }
                                />
                                {(() => {
                                    const url = buildTrackingUrl(
                                        order.tracking_carrier,
                                        order.tracking_number
                                    );
                                    return url ? (
                                            <div className="pt-2">
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5
                                            hover:text-accent hover:border-accent transition-colors"
                                                >
                                                    Voir le suivi →
                                                </a>
                                            </div>
                                        ) :
                                        null;
                                })()}
                            </div>
                        </Section>
                    )}

                    {/* Annulation / refund */}
                    {(order.cancelled_at || order.refunded_at) &&
                        order.refund_reason && (
                            <Section title={order.cancelled_at ? "Annulation" : "Remboursement"}>
                                <div className="border border-destructive/30 bg-destructive/5 p-5 space-y-2">
                                    <p className="text-sm whitespace-pre-line">
                                        {order.refund_reason}
                                    </p>
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                        {order.cancelled_at
                                            ? `Annulée le ${new Date(order.cancelled_at).toLocaleString("fr-BE")}`
                                            : `Remboursée le ${new Date(order.refunded_at!).toLocaleString("fr-BE")}`}
                                    </p>
                                </div>
                            </Section>
                        )}
                </div>

                {/* Colonne droite : récap finances + actions */}
                <div className="space-y-6">
                    {/* Récap financier */}
                    <Section title="Récapitulatif">
                        <div className="border border-border p-5 space-y-3">
                            <RowMoney
                                label="Sous-total"
                                cents={order.subtotal_cents}
                            />
                            {order.shipping_cents > 0 && (
                                <RowMoney
                                    label="Livraison"
                                    cents={order.shipping_cents}
                                />
                            )}
                            <div className="pt-3 border-t border-border">
                                <div className="flex items-baseline justify-between gap-4">
                                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                        Total payé
                                    </span>
                                    <span className="font-display text-2xl tracking-tight">
                                        {formatPriceEur(order.total_cents, {
                                            showFree: false,
                                        })}
                                    </span>
                                </div>
                            </div>
                            <div className="pt-3 border-t border-border space-y-1">
                                <div className="flex items-baseline justify-between gap-4 text-xs">
                                    <span className="text-muted-foreground">
                                        Commission Sente ({(order.commission_rate_bps / 100).toFixed(1)}%)
                                    </span>
                                    <span className="text-muted-foreground tabular-nums">
                                        −{formatPriceEur(order.sente_commission_cents, {
                                        showFree: false,
                                    })}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between gap-4 text-xs font-medium">
                                    <span>Tu reçois (net)</span>
                                    <span className="tabular-nums">
                                        {formatPriceEur(
                                            order.total_cents -
                                            order.sente_commission_cents,
                                            {showFree: false}
                                        )}
                                    </span>
                                </div>
                                {order.refunded_amount_cents > 0 && (
                                    <div
                                        className="flex items-baseline justify-between gap-4 text-xs text-destructive pt-2">
                                        <span>Déjà remboursé</span>
                                        <span className="tabular-nums">
                                            −{formatPriceEur(order.refunded_amount_cents, {
                                            showFree: false,
                                        })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Section>

                    <Section title="Actions">
                        <OrderTransitionPanel slug={slug} order={order} />
                    </Section>

                    <Section title="Remboursement">
                        <OrderRefundPanel order={order} />
                    </Section>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// Sous-composants
// =============================================================================

function Section({
                     title,
                     children,
                 }: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
                {title}
            </p>
            {children}
        </div>
    );
}

function Row({
                 label,
                 value,
             }: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right">{value}</span>
        </div>
    );
}

function RowMoney({label, cents}: { label: string; cents: number }) {
    return (
        <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">
                {formatPriceEur(cents, {showFree: false})}
            </span>
        </div>
    );
}

function ShippingAddressBlock({
                                  address,
                              }: {
    address: NonNullable<OrderDetail["shipping_address"]>;
}) {
    const addr = address.address;
    if (!addr) {
        return (
            <div className="border border-border p-5 text-xs text-muted-foreground italic">
                Adresse non renseignée par Stripe.
            </div>
        );
    }

    const lines = [
        address.name,
        addr.line1,
        addr.line2,
        [addr.postal_code, addr.city].filter(Boolean).join(" "),
        addr.state,
        addr.country,
    ].filter(Boolean);

    return (
        <div className="border border-border p-5">
            <address className="text-sm not-italic leading-relaxed">
                {lines.map((line, idx) => (
                    <span key={idx} className="block">
                        {line}
                    </span>
                ))}
            </address>
        </div>
    );
}