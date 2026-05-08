import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyAddresses } from "@/lib/dal/marketplace-addresses";
import { getCheckoutQuoteFromListing } from "@/app/actions/marketplace/checkout";
import { MarketplaceCheckout } from "@/components/sente/marketplace-checkout";

// =============================================================================
// Page : /profil/marketplace/checkout/annonce/[id]
// =============================================================================
// Achat direct au prix listing (pas via offre).
// =============================================================================

export default async function CheckoutListingPage({
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
        redirect(`/login?next=/profil/marketplace/checkout/annonce/${id}`);
    }

    const quoteResult = await getCheckoutQuoteFromListing({ listingId: id });
    if (!quoteResult.ok) {
        return (
            <div className="space-y-8 max-w-2xl">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Marketplace · Paiement
                    </p>
                    <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                        Achat impossible
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
                    href="/marketplace"
                    className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                >
                    ← Retour au marketplace
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
                    Marketplace · Paiement
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Commande
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                    Adresse de livraison, mode d&apos;envoi, puis redirection vers Stripe
                    pour le paiement sécurisé.
                </p>
            </div>

            <MarketplaceCheckout
                contextType="listing"
                contextId={id}
                initialQuote={quoteResult.data}
                addresses={addresses}
            />
        </div>
    );
}