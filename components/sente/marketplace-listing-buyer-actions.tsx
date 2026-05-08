"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startThreadWithMessage } from "@/app/actions/marketplace/threads";
import { startThreadWithOffer } from "@/app/actions/marketplace/offers";

// =============================================================================
// MarketplaceListingBuyerActions
// =============================================================================
// CTAs côté acheteur sur la page détail publique : Acheter / Faire une offre /
// Message vendeur. Affiché uniquement quand user connecté ET pas le vendeur.
// =============================================================================

type Mode = null | "offer" | "message";

const INPUT_CLS =
    "mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent";

export function MarketplaceListingBuyerActions({
                                                   listingId,
                                                   priceCents,
                                                   disabled = false,
                                                   disabledReason,
                                               }: {
    listingId: string;
    priceCents: number;
    disabled?: boolean;
    disabledReason?: string;
}) {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>(null);
    const [offerEuros, setOfferEuros] = useState("");
    const [body, setBody] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleOfferSubmit(e: React.FormEvent) {
        e.preventDefault();
        const cents = Math.round(parseFloat(offerEuros) * 100);
        if (!Number.isFinite(cents) || cents < 100) {
            setError("Montant invalide (minimum 1,00 €)");
            return;
        }
        if (cents > priceCents) {
            setError("L'offre ne peut pas dépasser le prix demandé");
            return;
        }
        setError(null);

        startTransition(async () => {
            const result = await startThreadWithOffer({
                listingId,
                amountCents: cents,
            });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            router.push(`/profil/marketplace/messages/${result.data.thread_id}`);
        });
    }

    function handleMessageSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!body.trim()) return;
        setError(null);

        startTransition(async () => {
            const result = await startThreadWithMessage({
                listingId,
                body: body.trim(),
            });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            router.push(`/profil/marketplace/messages/${result.data.thread_id}`);
        });
    }

    if (disabled) {
        return (
            <div className="border border-border bg-secondary/40 py-3 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {disabledReason ?? "Annonce non disponible"}
                </p>
            </div>
        );
    }

    // Mode initial : Acheter (Link) + Offre + Message
    if (mode === null) {
        return (
            <div className="space-y-3">
                <Link
                    href={`/profil/marketplace/checkout/annonce/${listingId}`}
                    className="block w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors py-3 text-center text-xs uppercase tracking-wide font-medium"
                >
                    Acheter maintenant →
                </Link>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            setMode("offer");
                            setError(null);
                        }}
                        className="border border-border hover:border-foreground transition-colors py-2.5 text-xs uppercase tracking-wide"
                    >
                        Faire une offre
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMode("message");
                            setError(null);
                        }}
                        className="border border-border hover:border-foreground transition-colors py-2.5 text-xs uppercase tracking-wide"
                    >
                        Message vendeur
                    </button>
                </div>
            </div>
        );
    }

    // Form offre
    if (mode === "offer") {
        return (
            <form
                onSubmit={handleOfferSubmit}
                className="space-y-4 border border-border bg-secondary/20 p-5"
            >
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Faire une offre
                </p>

                <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        Ton offre (€)
                    </span>
                    <input
                        type="number"
                        value={offerEuros}
                        onChange={(e) => setOfferEuros(e.target.value)}
                        min="1"
                        max={priceCents / 100}
                        step="0.01"
                        required
                        autoFocus
                        placeholder={`Maximum ${(priceCents / 100).toFixed(2)} €`}
                        className={INPUT_CLS}
                    />
                </label>

                <p className="text-xs text-muted-foreground leading-relaxed">
                    Le vendeur recevra ton offre et pourra l&apos;accepter ou la refuser.
                    Tu peux faire jusqu&apos;à 3 offres en parallèle sur le marketplace.
                </p>

                {error && (
                    <div className="border border-destructive/30 bg-destructive/5 p-3">
                        <p className="text-xs text-destructive">{error}</p>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={isPending || !offerEuros}
                        className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 transition-colors py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                    >
                        {isPending ? "Envoi…" : "Envoyer l'offre"}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMode(null);
                            setOfferEuros("");
                            setError(null);
                        }}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Annuler
                    </button>
                </div>
            </form>
        );
    }

    // Form message
    return (
        <form
            onSubmit={handleMessageSubmit}
            className="space-y-4 border border-border bg-secondary/20 p-5"
        >
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Message au vendeur
            </p>

            <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                maxLength={2000}
                required
                autoFocus
                placeholder="Bonjour, je suis intéressé par cette canne. Est-ce que…"
                className={`${INPUT_CLS} resize-y`}
            />

            <p className="text-xs text-muted-foreground leading-relaxed">
                Pour ta sécurité, ne partage pas d&apos;email ou de numéro de téléphone —
                toutes les transactions doivent passer par Sente.
            </p>

            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}

            <div className="flex items-center gap-4">
                <button
                    type="submit"
                    disabled={isPending || !body.trim()}
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 transition-colors py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending ? "Envoi…" : "Envoyer"}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMode(null);
                        setBody("");
                        setError(null);
                    }}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}