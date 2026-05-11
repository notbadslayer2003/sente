import Link from "next/link";
import {ExternalLink, Truck, Store} from "lucide-react";
import type {OrderDetail, OrderRefundEvent} from "@/lib/dal/orders";
import {formatPriceEur} from "@/lib/utils/format";
import { buildTrackingUrl, carrierLabel } from "@/lib/utils/tracking-links";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    pending_payment: {
        label: "Paiement en cours",
        className: "bg-muted text-muted-foreground",
    },
    paid: {label: "Payée", className: "bg-primary/15 text-primary"},
    preparing: {
        label: "En préparation",
        className: "bg-accent/15 text-accent",
    },
    ready_for_pickup: {
        label: "Prête à retirer",
        className: "bg-accent/15 text-accent",
    },
    shipped: {label: "Expédiée", className: "bg-accent/15 text-accent"},
    delivered: {label: "Livrée", className: "bg-primary/15 text-primary"},
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

const DELIVERY_ICONS: Record<string, React.ReactNode> = {
    click_collect: <Store className="w-4 h-4" strokeWidth={2}/>,
    shipping_standard: <Truck className="w-4 h-4" strokeWidth={2}/>,
    shipping_local: <Truck className="w-4 h-4" strokeWidth={2}/>,
};

type Props = {
    order: OrderDetail;
    refunds: OrderRefundEvent[];
};

export function OrderBuyerDetailView({order, refunds}: Props) {
    const status = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending_payment;
    const orderShort = order.id.slice(0, 8).toUpperCase();
    const isShipping =
        order.delivery_method === "shipping_standard" ||
        order.delivery_method === "shipping_local";

    const trackingUrl =
        order.tracking_carrier && order.tracking_number
            ? buildTrackingUrl(order.tracking_carrier, order.tracking_number)
            : null;

    const totalRefunded = refunds.reduce((sum, r) => sum + r.amount_cents, 0);

    return (
        <article className="mt-6 space-y-10">
            {/* Header */}
            <header className="space-y-4">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Commande #{orderShort}
                        </p>
                        <h1 className="mt-3 font-display-soft text-4xl tracking-tight leading-[0.95]">
                            <Link
                                href={`/magasins/${order.magasin.slug}`}
                                className="hover:text-accent transition-colors"
                            >
                                {order.magasin.name}.
                            </Link>
                        </h1>
                    </div>
                    <span
                        className={`px-3 py-1 text-[10px] uppercase tracking-wide ${status.className}`}
                    >
                        {status.label}
                    </span>
                </div>

                <p className="text-sm text-muted-foreground">
                    {order.paid_at
                        ? `Payée le ${formatDate(order.paid_at)}`
                        : `Créée le ${formatDate(order.created_at)}`}
                </p>
            </header>

            {/* Tracking / pickup info */}
            {(order.status === "ready_for_pickup" ||
                order.status === "shipped" ||
                order.status === "delivered") && (
                <div className="border border-accent/30 bg-accent/5 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-accent">
                        {order.delivery_method && DELIVERY_ICONS[order.delivery_method]}
                        <span>
                            {order.delivery_method &&
                                DELIVERY_LABELS[order.delivery_method]}
                        </span>
                    </div>

                    {order.status === "ready_for_pickup" && (
                        <p className="text-sm">
                            Ta commande est <strong>prête à retirer</strong> chez{" "}
                            {order.magasin.name}. Présente-toi avec ton numéro de
                            commande{" "}
                            <span className="font-mono">#{orderShort}</span>.
                        </p>
                    )}

                    {order.status === "shipped" && (
                        <div className="space-y-2">
                            <p className="text-sm">
                                Ta commande a été expédiée
                                {order.shipped_at && (
                                    <> le {formatDate(order.shipped_at)}</>
                                )}
                                .
                            </p>
                            {order.tracking_carrier && order.tracking_number && (
                                <p className="text-xs text-muted-foreground">
                                    Transporteur :{" "}
                                    <strong>{carrierLabel(order.tracking_carrier)}</strong>{" "}
                                    · Numéro de suivi :{" "}
                                    <span className="font-mono">
                                        {order.tracking_number}
                                    </span>
                                </p>
                            )}
                            {trackingUrl && (
                                <a
                                    href={trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                                >
                                    Suivre le colis
                                    <ExternalLink className="w-3 h-3" strokeWidth={2}/>
                                </a>
                            )}
                        </div>
                    )}

                    {order.status === "delivered" && (
                        <p className="text-sm">
                            Commande livrée
                            {order.delivered_at && (
                                <> le {formatDate(order.delivered_at)}</>
                            )}
                            .
                        </p>
                    )}
                </div>
            )}

            {/* Adresse de livraison */}
            {isShipping && order.shipping_address && (
                <section>
                    <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">
                        Adresse de livraison
                    </h2>
                    <div className="border border-border p-4 text-sm space-y-0.5">
                        {order.shipping_address.name && (
                            <p className="font-medium">{order.shipping_address.name}</p>
                        )}
                        {order.shipping_address.address?.line1 && (
                            <p>{order.shipping_address.address.line1}</p>
                        )}
                        {order.shipping_address.address?.line2 && (
                            <p>{order.shipping_address.address.line2}</p>
                        )}
                        {(order.shipping_address.address?.postal_code ||
                            order.shipping_address.address?.city) && (
                            <p>
                                {order.shipping_address.address.postal_code}{" "}
                                {order.shipping_address.address.city}
                            </p>
                        )}
                        {order.shipping_address.address?.country && (
                            <p className="text-muted-foreground">
                                {order.shipping_address.address.country}
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* Items */}
            <section>
                <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">
                    Articles
                </h2>
                <ul className="border border-border divide-y divide-border">
                    {order.items.map((item) => {
                        const isFullyRefunded =
                            item.refunded_quantity >= item.quantity;
                        return (
                            <li
                                key={item.id}
                                className="p-4 flex items-start justify-between gap-4"
                            >
                                <div className="min-w-0 flex-1">
                                    <p
                                        className={`text-sm font-medium ${
                                            isFullyRefunded
                                                ? "text-muted-foreground line-through"
                                                : ""
                                        }`}
                                    >
                                        {item.product_name}
                                    </p>
                                    {item.variant_name && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {item.variant_name}
                                        </p>
                                    )}
                                    {item.sku && (
                                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                            SKU: {item.sku}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatPriceEur(item.unit_price_cents, {
                                            showFree: false,
                                        })}{" "}
                                        × {item.quantity}
                                        {item.refunded_quantity > 0 && (
                                            <span className="ml-2 text-destructive">
                                                ({item.refunded_quantity} remboursé
                                                {item.refunded_quantity > 1 ? "s" : ""})
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <p className="text-sm font-medium whitespace-nowrap">
                                    {formatPriceEur(item.line_total_cents, {
                                        showFree: false,
                                    })}
                                </p>
                            </li>
                        );
                    })}
                </ul>
            </section>

            {/* Totaux */}
            <section>
                <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">
                    Total
                </h2>
                <div className="border border-border p-5 space-y-2">
                    <Row label="Sous-total" amount={order.subtotal_cents}/>
                    {order.shipping_cents > 0 && (
                        <Row
                            label={
                                order.delivery_method
                                    ? DELIVERY_LABELS[order.delivery_method]
                                    : "Livraison"
                            }
                            amount={order.shipping_cents}
                        />
                    )}
                    <div className="border-t border-border pt-3 flex items-center justify-between">
                        <span className="text-sm font-medium">Total payé</span>
                        <span className="font-display text-xl">
                            {formatPriceEur(order.total_cents, {showFree: false})}
                        </span>
                    </div>
                    {totalRefunded > 0 && (
                        <div className="flex items-center justify-between text-sm text-destructive">
                            <span>Total remboursé</span>
                            <span>
                                −
                                {formatPriceEur(totalRefunded, {showFree: false})}
                            </span>
                        </div>
                    )}
                </div>
            </section>

            {/* Historique remboursements */}
            {refunds.length > 0 && (
                <section>
                    <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">
                        Historique des remboursements
                    </h2>
                    <ul className="border border-border divide-y divide-border">
                        {refunds.map((r) => (
                            <li key={r.id} className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm">
                                            {r.kind === "shipping" ? (
                                                <strong>Frais de port remboursés</strong>
                                            ) : r.item_name ? (
                                                <>
                                                    Remboursement —{" "}
                                                    <strong>{r.item_name}</strong>
                                                    {r.item_quantity ? (
                                                        <>
                                                            {" "}
                                                            ({r.item_quantity} unité
                                                            {r.item_quantity > 1
                                                                ? "s"
                                                                : ""}
                                                            )
                                                        </>
                                                    ) : null}
                                                </>
                                            ) : (
                                                <strong>Remboursement</strong>
                                            )}
                                        </p>
                                        {r.reason && (
                                            <p className="mt-1 text-xs text-muted-foreground italic">
                                                « {r.reason} »
                                            </p>
                                        )}
                                        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                            {formatDate(r.created_at)}
                                        </p>
                                    </div>
                                    <p className="text-sm font-medium text-destructive whitespace-nowrap">
                                        −
                                        {formatPriceEur(r.amount_cents, {
                                            showFree: false,
                                        })}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* Contact */}
            <section className="border-t border-border pt-8">
                <p className="text-xs text-muted-foreground">
                    Une question sur cette commande ?{" "}
                    <Link
                        href={`/magasins/${order.magasin.slug}`}
                        className="underline hover:text-accent transition-colors"
                    >
                        Contacte {order.magasin.name}
                    </Link>{" "}
                    directement.
                </p>
            </section>
        </article>
    );
}

function Row({label, amount}: { label: string; amount: number }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span>{formatPriceEur(amount, {showFree: false})}</span>
        </div>
    );
}

function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("fr-BE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}