import Link from "next/link";
import {notFound, redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {formatCents} from "@/lib/marketplace/pricing";
import {MarketplaceShipmentActions} from "@/components/sente/marketplace-shipment-actions";
import { MarketplaceConfirmReceivedButton } from "@/components/sente/marketplace-confirm-received-button";

// =============================================================================
// Page : /profil/marketplace/commandes/[id]
// =============================================================================
// Détail d'une order, accessible par buyer ET seller (vue conditionnelle sur
// les détails financiers). Le ?session_id Stripe peut être présent au retour
// checkout — on n'agit pas dessus côté front, c'est le webhook qui met à jour
// le statut. La page reflète juste l'état DB courant.
// =============================================================================

type StatusTone = "info" | "success" | "neutral" | "danger";

function getStatusInfo(
    status: string,
    isSeller: boolean
): { label: string; tone: StatusTone; description: string } {
    // Description différente seller vs buyer ; label et tone identiques
    const descriptions: Record<string, { buyer: string; seller: string }> = {
        pending_payment: {
            buyer: "Ton paiement est en cours de traitement par notre prestataire. Cette page se mettra à jour dans quelques secondes.",
            seller: "L'acheteur est en train de finaliser son paiement. Tu seras notifié dès qu'il est confirmé.",
        },
        paid_awaiting_shipment: {
            buyer: "Le paiement est confirmé. Le vendeur prépare ton colis pour expédition.",
            seller: "Le paiement est confirmé. Prépare le colis et clique sur \"Marquer comme expédié\" pour générer l'étiquette Mondial Relay.",
        },
        shipped: {
            buyer: "Ton colis est en route. Tu seras notifié dès qu'il sera disponible au point relais.",
            seller: "Le colis est expédié. Tu peux télécharger l'étiquette PDF ci-dessous si tu en as besoin.",
        },
        delivered: {
            buyer: "Ton colis a été livré.",
            seller: "Le colis a été livré. Le paiement sera transféré sur ton compte sous 48h.",
        },
        released: {
            buyer: "La transaction est terminée.",
            seller: "Transaction clôturée. Le paiement a été transféré sur ton compte.",
        },
        closed: {buyer: "Transaction clôturée.", seller: "Transaction clôturée."},
        cancelled: {
            buyer: "Cette commande a été annulée.",
            seller: "Cette commande a été annulée.",
        },
        disputed: {
            buyer: "Un litige a été ouvert sur cette commande. Notre équipe est en train de l'examiner.",
            seller: "Un litige a été ouvert. Notre équipe va te contacter sous peu.",
        },
        refunded: {
            buyer: "La somme a été remboursée.",
            seller: "La commande a été remboursée à l'acheteur.",
        },
    };

    const tones: Record<string, { label: string; tone: StatusTone }> = {
        pending_payment: {label: "Paiement en cours", tone: "info"},
        paid_awaiting_shipment: {label: "En attente d'envoi", tone: "info"},
        shipped: {label: "Expédiée", tone: "info"},
        delivered: {label: "Livrée", tone: "success"},
        released: {label: "Clôturée", tone: "success"},
        closed: {label: "Clôturée", tone: "neutral"},
        cancelled: {label: "Annulée", tone: "neutral"},
        disputed: {label: "Litige en cours", tone: "danger"},
        refunded: {label: "Remboursée", tone: "neutral"},
    };

    const tone = tones[status] ?? {label: status, tone: "neutral" as StatusTone};
    const desc = descriptions[status];
    return {
        label: tone.label,
        tone: tone.tone,
        description: desc ? (isSeller ? desc.seller : desc.buyer) : "",
    };
}

const TONE_BADGE_CLS: Record<StatusTone, string> = {
    info: "bg-accent/15 text-accent",
    success: "bg-primary/15 text-primary",
    neutral: "bg-secondary/40 text-muted-foreground",
    danger: "bg-destructive/15 text-destructive",
};

const TONE_BOX_CLS: Record<StatusTone, { box: string; eyebrow: string }> = {
    info: {
        box: "border-accent/30 bg-accent/5",
        eyebrow: "text-accent",
    },
    success: {
        box: "border-primary/30 bg-primary/5",
        eyebrow: "text-primary",
    },
    neutral: {
        box: "border-border bg-secondary/20",
        eyebrow: "text-muted-foreground",
    },
    danger: {
        box: "border-destructive/30 bg-destructive/5",
        eyebrow: "text-destructive",
    },
};

const CARRIER_LABELS: Record<string, string> = {
    mondial_relay: "Mondial Relay",
    colissimo: "Colissimo",
};

export default async function OrderDetailPage({
                                                  params,
                                              }: {
    params: Promise<{ id: string }>;
}) {
    const {id} = await params;

    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();
    if (!user) redirect(`/login?next=/profil/marketplace/commandes/${id}`);

    const {data: order} = await supabase
        .from("marketplace_orders")
        .select(`
            *,
            listing:marketplace_listings!listing_id(id, title)
        `)
        .eq("id", id)
        .maybeSingle();

    if (!order) notFound();

    const isBuyer = order.buyer_user_id === user.id;
    const isSeller = order.seller_user_id === user.id;
    if (!isBuyer && !isSeller) notFound();

    const statusInfo = getStatusInfo(order.status, isSeller);
    const carrierLabel =
        CARRIER_LABELS[order.shipping_carrier] ?? order.shipping_carrier;

    const orderShortId = order.id.slice(0, 8).toUpperCase();
    const tone = TONE_BOX_CLS[statusInfo.tone];

    return (
        <div className="space-y-10 max-w-3xl">
            {/* Header */}
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Marketplace · Commande #{orderShortId}
                </p>
                <div className="mt-3 flex flex-wrap items-baseline gap-4">
                    <h1 className="font-display text-4xl tracking-tight leading-[1.05]">
                        Commande
                    </h1>
                    <span
                        className={`text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 ${TONE_BADGE_CLS[statusInfo.tone]}`}
                    >
                        {statusInfo.label}
                    </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                    {isBuyer ? "Achat" : "Vente"} ·{" "}
                    <span className="text-foreground">
                        {order.listing?.title ?? "Annonce supprimée"}
                    </span>
                </p>
            </div>

            {/* Bandeau description du statut */}
            {statusInfo.description && (
                <div className={`border p-5 ${tone.box}`}>
                    <p
                        className={`text-[10px] uppercase tracking-[0.25em] ${tone.eyebrow}`}
                    >
                        {statusInfo.label}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">
                        {statusInfo.description}
                    </p>
                </div>
            )}

            {/* Article */}
            <Card eyebrow="Article">
                <p className="font-display text-lg tracking-tight">
                    {order.listing?.title ?? "Annonce supprimée"}
                </p>
            </Card>

            {/* Récap prix */}
            <Card eyebrow="Détail prix">
                <dl className="divide-y divide-border border-y border-border">
                    <Row label="Article" value={formatCents(order.item_price_cents)}/>
                    <Row label="Livraison" value={formatCents(order.shipping_cents)}/>
                    {isBuyer && (
                        <Row
                            label="Frais de service"
                            value={formatCents(order.stripe_fees_cents)}
                            muted
                        />
                    )}
                    {isBuyer ? (
                        <Row
                            label="Total payé"
                            value={formatCents(order.total_cents)}
                            bold
                        />
                    ) : (
                        <>
                            <Row
                                label="Commission Sente"
                                value={`− ${formatCents(order.commission_cents)}`}
                                muted
                            />
                            <Row
                                label="Net vendeur"
                                value={formatCents(order.seller_payout_cents)}
                                bold
                            />
                        </>
                    )}
                </dl>
                {isSeller && (
                    <p className="mt-3 text-xs text-muted-foreground italic">
                        Le montant net inclut les frais de livraison conservés par
                        Sente le temps de l&apos;émission de l&apos;étiquette.
                    </p>
                )}
            </Card>

            {/* Livraison */}
            <Card eyebrow="Livraison">
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Transporteur
                        </p>
                        <p className="mt-1 text-sm">{carrierLabel}</p>
                        {order.relay_point_id && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Point relais : {order.relay_point_id}
                            </p>
                        )}
                    </div>

                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Adresse
                        </p>
                        <div className="mt-1 text-sm">
                            <p>{order.shipping_full_name}</p>
                            <p className="text-muted-foreground">
                                {order.shipping_line1}
                                {order.shipping_line2 && <>, {order.shipping_line2}</>}
                            </p>
                            <p className="text-muted-foreground">
                                {order.shipping_postal_code} {order.shipping_city},{" "}
                                {order.shipping_country}
                            </p>
                            {order.shipping_phone && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Tél. {order.shipping_phone}
                                </p>
                            )}
                        </div>
                    </div>

                    {order.tracking_number && (
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                N° de suivi
                            </p>
                            <p className="mt-1 text-sm font-mono">
                                {order.tracking_number}
                            </p>
                            <a
                                href={`https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${order.tracking_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block text-xs text-accent hover:text-accent/80 underline underline-offset-2"
                            >
                                Suivre le colis sur Mondial Relay →
                            </a>
                        </div>
                    )}

                    {/* Actions seller : Marquer comme expédié OU Télécharger l'étiquette */}
                    {isSeller && (
                        <div className="pt-4 border-t border-border">
                            <MarketplaceShipmentActions
                                orderId={order.id}
                                status={order.status}
                            />
                        </div>
                    )}
                    {/* Action buyer : confirmer la réception */}
                    {isBuyer && order.status === "shipped" && (
                        <div className="pt-4 border-t border-border">
                            <MarketplaceConfirmReceivedButton orderId={order.id} />
                        </div>
                    )}
                </div>
            </Card>


            {/* Lien retour discret en bas */}
            <div className="pt-4 border-t border-border">
                <Link
                    href={
                        isBuyer
                            ? "/profil/marketplace/messages"
                            : "/profil/marketplace/annonces"
                    }
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                >
                    ← {isBuyer ? "Mes conversations" : "Mes annonces"}
                </Link>
            </div>
        </div>
    );
}

function Card({
                  eyebrow,
                  children,
              }: {
    eyebrow: string;
    children: React.ReactNode;
}) {
    return (
        <section className="border border-border p-6">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {eyebrow}
            </p>
            <div className="mt-3">{children}</div>
        </section>
    );
}

function Row({
                 label,
                 value,
                 bold,
                 muted,
             }: {
    label: string;
    value: string;
    bold?: boolean;
    muted?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-3">
            <dt
                className={`text-[10px] uppercase tracking-[0.2em] ${
                    muted ? "text-muted-foreground/70" : "text-muted-foreground"
                }`}
            >
                {label}
            </dt>
            <dd
                className={
                    bold
                        ? "font-display text-2xl tracking-tight"
                        : muted
                            ? "text-sm text-muted-foreground"
                            : "text-sm"
                }
            >
                {value}
            </dd>
        </div>
    );
}