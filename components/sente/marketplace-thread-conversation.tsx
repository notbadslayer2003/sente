"use client";

import {useEffect, useRef, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {sendMessage} from "@/app/actions/marketplace/threads";
import {
    makeOffer,
    acceptOffer,
    rejectOffer,
    withdrawOffer,
} from "@/app/actions/marketplace/offers";

// =============================================================================
// Composant : MarketplaceThreadConversation
// =============================================================================
// Timeline (messages + offres mélangés et triés) + zone de saisie. Style aligné
// sur le design system Sente : pas de coins arrondis, couleurs sémantiques.
// =============================================================================

type Message = {
    id: string;
    sender_user_id: string;
    body: string;
    created_at: string;
    flagged: boolean;
};

type Offer = {
    id: string;
    buyer_user_id: string;
    amount_cents: number;
    status:
        | "pending"
        | "accepted"
        | "rejected"
        | "withdrawn"
        | "expired"
        | "countered"
        | "cancelled";
    created_at: string;
};

type TimelineItem =
    | { kind: "message"; data: Message }
    | { kind: "offer"; data: Offer };

const OFFER_STATUS: Record<
    Offer["status"],
    { label: string; className: string }
> = {
    pending: {label: "En attente", className: "bg-secondary/60 text-foreground"},
    accepted: {label: "Acceptée", className: "bg-primary/15 text-primary"},
    rejected: {label: "Refusée", className: "bg-destructive/15 text-destructive"},
    withdrawn: {label: "Retirée", className: "bg-secondary/60 text-muted-foreground"},
    expired: {label: "Expirée", className: "bg-secondary/60 text-muted-foreground"},
    countered: {label: "Contre-offre", className: "bg-accent/15 text-accent"},
    cancelled: {label: "Annulée", className: "bg-secondary/60 text-muted-foreground"},
};

function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString("fr-BE", {
        style: "currency",
        currency: "EUR",
    });
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString("fr-BE", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function MarketplaceThreadConversation({
                                                  threadId,
                                                  currentUserId,
                                                  isBuyer,
                                                  listingPriceCents,
                                                  listingStatus,
                                                  messages,
                                                  offers,
                                              }: {
    threadId: string;
    currentUserId: string;
    isBuyer: boolean;
    listingPriceCents: number;
    listingStatus: string;
    messages: Message[];
    offers: Offer[];
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [body, setBody] = useState("");
    const [showOfferForm, setShowOfferForm] = useState(false);
    const [offerEuros, setOfferEuros] = useState("");

    const timelineRef = useRef<HTMLDivElement>(null);

    const timeline: TimelineItem[] = [
        ...messages.map((m): TimelineItem => ({kind: "message", data: m})),
        ...offers.map((o): TimelineItem => ({kind: "offer", data: o})),
    ].sort((a, b) => a.data.created_at.localeCompare(b.data.created_at));

    // Auto-scroll en bas au mount + à chaque nouveau message
    useEffect(() => {
        if (timelineRef.current) {
            timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
        }
    }, [timeline.length]);

    function handleSendMessage(e: React.FormEvent) {
        e.preventDefault();
        if (!body.trim()) return;
        setError(null);
        setInfo(null);

        startTransition(async () => {
            const result = await sendMessage({threadId, body: body.trim()});
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            setBody("");
            if (result.data.flagged) {
                setInfo(
                    "Message envoyé. Pour ta sécurité, évite de partager email/téléphone — toutes les transactions doivent passer par Sente."
                );
            }
            router.refresh();
        });
    }

    function handleMakeOffer(e: React.FormEvent) {
        e.preventDefault();
        const cents = Math.round(parseFloat(offerEuros) * 100);
        if (!Number.isFinite(cents) || cents < 100) {
            setError("Montant invalide");
            return;
        }
        setError(null);

        startTransition(async () => {
            const result = await makeOffer({threadId, amountCents: cents});
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            setOfferEuros("");
            setShowOfferForm(false);
            router.refresh();
        });
    }

    function handleAccept(offerId: string) {
        if (
            !confirm(
                "Accepter cette offre ? L'annonce sera réservée 48h pour permettre le paiement."
            )
        )
            return;
        setError(null);
        startTransition(async () => {
            const result = await acceptOffer({offerId});
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            router.refresh();
        });
    }

    function handleReject(offerId: string) {
        if (!confirm("Refuser cette offre ?")) return;
        setError(null);
        startTransition(async () => {
            const result = await rejectOffer({offerId});
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            router.refresh();
        });
    }

    function handleWithdraw(offerId: string) {
        if (!confirm("Retirer ton offre ?")) return;
        setError(null);
        startTransition(async () => {
            const result = await withdrawOffer({offerId});
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            router.refresh();
        });
    }

    const canMessage = listingStatus !== "removed";
    const canOffer = isBuyer && listingStatus === "active";
    const canAcceptReject = !isBuyer && listingStatus === "active";

    return (
        <div className="border border-border bg-background">
            {/* Timeline scrollable */}
            <div
                ref={timelineRef}
                className="flex max-h-[65vh] min-h-[320px] flex-col gap-3 overflow-y-auto p-5"
            >
                {timeline.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                        Aucun message pour le moment.
                    </p>
                )}

                {timeline.map((item) => {
                    if (item.kind === "message") {
                        const isMine = item.data.sender_user_id === currentUserId;
                        return (
                            <div
                                key={`m-${item.data.id}`}
                                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[78%] px-4 py-2.5 ${
                                        isMine
                                            ? "bg-accent/10 border-r-2 border-accent"
                                            : "bg-secondary/40 border-l-2 border-border"
                                    }`}
                                >
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {item.data.body}
                                    </p>
                                    <p className="mt-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                        {formatTime(item.data.created_at)}
                                        {item.data.flagged && (
                                            <span className="ml-2 text-destructive">
                                                · flag modération
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        );
                    }

                    // OFFER card
                    const offer = item.data;
                    const status = OFFER_STATUS[offer.status];
                    const isOfferMine = offer.buyer_user_id === currentUserId;

                    return (
                        <div key={`o-${offer.id}`} className="flex justify-center my-2">
                            <div className="w-full max-w-md border border-accent/40 bg-accent/5 p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                                            {isOfferMine ? "Tu as proposé" : "Offre reçue"}
                                        </p>
                                        <p className="mt-1 font-display text-2xl tracking-tight">
                                            {formatPrice(offer.amount_cents)}
                                        </p>
                                    </div>
                                    <span
                                        className={`whitespace-nowrap text-[10px] uppercase tracking-[0.2em] px-2 py-1 ${status.className}`}
                                    >
                                        {status.label}
                                    </span>
                                </div>

                                <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                                    {formatTime(offer.created_at)}
                                </p>

                                {/* Actions sur offre pending */}
                                {offer.status === "pending" && (
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        {canAcceptReject && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAccept(offer.id)}
                                                    disabled={isPending}
                                                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-4 py-2 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                                                >
                                                    Accepter
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleReject(offer.id)}
                                                    disabled={isPending}
                                                    className="border border-border hover:border-destructive hover:text-destructive transition-colors px-4 py-2 text-xs uppercase tracking-wide disabled:opacity-50"
                                                >
                                                    Refuser
                                                </button>
                                            </>
                                        )}
                                        {isOfferMine && isBuyer && (
                                            <button
                                                type="button"
                                                onClick={() => handleWithdraw(offer.id)}
                                                disabled={isPending}
                                                className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                            >
                                                Retirer mon offre
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Offre acceptée — CTA paiement côté buyer */}
                                {offer.status === "accepted" && isOfferMine && isBuyer && (
                                    <Link
                                        href={`/profil/marketplace/checkout/offre/${offer.id}`}
                                        className="mt-4 inline-flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium"
                                    >
                                        Procéder au paiement →
                                    </Link>
                                )}
                                {offer.status === "accepted" && !isOfferMine && (
                                    <p className="mt-3 text-xs text-muted-foreground italic">
                                        Annonce réservée 48h pour finaliser le paiement.
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Erreurs / infos */}
            {error && (
                <div className="border-t border-destructive/30 bg-destructive/10 px-5 py-3 text-xs text-destructive">
                    {error}
                </div>
            )}
            {info && (
                <div className="border-t border-accent/30 bg-accent/10 px-5 py-3 text-xs text-accent">
                    {info}
                </div>
            )}

            {/* Zone de saisie */}
            {canMessage && (
                <div className="border-t border-border bg-secondary/20">
                    {showOfferForm ? (
                        <form
                            onSubmit={handleMakeOffer}
                            className="flex flex-wrap items-center gap-3 p-4"
                        >
                            <label className="flex-1 min-w-[200px]">
                                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                                    Montant de l&apos;offre (€)
                                </span>
                                <input
                                    type="number"
                                    value={offerEuros}
                                    onChange={(e) => setOfferEuros(e.target.value)}
                                    placeholder={`Max ${(listingPriceCents / 100).toFixed(2)}`}
                                    min="1"
                                    step="0.01"
                                    max={listingPriceCents / 100}
                                    required
                                    autoFocus
                                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                                />
                            </label>
                            <div className="flex items-end gap-3">
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                                >
                                    Envoyer l&apos;offre
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowOfferForm(false);
                                        setOfferEuros("");
                                    }}
                                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Annuler
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form
                            onSubmit={handleSendMessage}
                            className="flex items-end gap-3 p-4"
                        >
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Écrire un message…"
                                rows={2}
                                maxLength={2000}
                                className="flex-1 resize-none bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleSendMessage(e as unknown as React.FormEvent);
                                    }
                                }}
                            />
                            <div className="flex flex-col gap-2 flex-shrink-0">
                                <button
                                    type="submit"
                                    disabled={isPending || !body.trim()}
                                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                                >
                                    Envoyer
                                </button>
                                {canOffer && (
                                    <button
                                        type="button"
                                        onClick={() => setShowOfferForm(true)}
                                        className="border border-border hover:border-accent hover:text-accent transition-colors px-3 py-2 text-[10px] uppercase tracking-[0.2em]"
                                    >
                                        Faire une offre
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}