import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyAddresses } from "@/lib/dal/marketplace-addresses";
import { getCheckoutQuoteFromOffer } from "@/app/actions/marketplace/checkout";
import { MarketplaceCheckout } from "@/components/sente/marketplace-checkout";

// =============================================================================
// Page : /profil/marketplace/checkout/offre/[id]
// =============================================================================
// Paiement d'une offre acceptée (listing en status='reserved').
// =============================================================================

export default async function CheckoutOfferPage({
                                                    params,
                                                }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        redirect(`/login?next=/profil/marketplace/checkout/offre/${id}`);
    }

    const quoteResult = await getCheckoutQuoteFromOffer({ offerId: id });
    if (!quoteResult.ok) {
        return (
            <div className="space-y-8 max-w-2xl">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Marketplace · Paiement
                    </p>
                    <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                        Paiement impossible
                    </h1>
                </div>
                <div className="border border-destructive/30 bg-destructive/5 p-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-destructive">
                        Erreur
                    </p>
                    <p className="mt-2 text-sm text-foreground">
                        {quoteResult.error.message}
                    </p>
                </div>
                <Link
                    href="/profil/marketplace/messages"
                    className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                >
                    ← Retour aux conversations
                </Link>
            </div>
        );
    }

    if (quoteResult.data.shipping_options.length === 0) {
        notFound();
    }

    const addresses = await getMyAddresses();

    return (
        <div className="space-y-12 max-w-3xl">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Marketplace · Paiement d&apos;une offre
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Finaliser l&apos;achat
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                    Le vendeur a accepté ton offre. L&apos;annonce est réservée 48h le
                    temps que tu finalises le paiement.
                </p>
            </div>

            <MarketplaceCheckout
                contextType="offer"
                contextId={id}
                initialQuote={quoteResult.data}
                addresses={addresses}
            />
        </div>
    );
}