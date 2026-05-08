import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {
    getMyListings,
    type MarketplaceListingStatus,
} from "@/lib/dal/marketplace-listings";
import {getMarketplacePublicUrl} from "@/lib/storage/marketplace-r2";
import {ListingActions} from "@/components/sente/marketplace-listing-actions";

// =============================================================================
// Page : /profil/marketplace/annonces
// =============================================================================
// Liste les annonces du vendeur (tous statuts). Si pas de seller_account →
// redirect vers compte-vendeur. Si KYC pas verified → bandeau d'avertissement
// mais on autorise la consultation/préparation des annonces.
// =============================================================================

const STATUS_LABELS: Record<
    MarketplaceListingStatus,
    { label: string; className: string }
> = {
    draft: {
        label: "Brouillon",
        className: "bg-secondary/40 text-muted-foreground",
    },
    pending_review: {
        label: "En modération",
        className: "bg-accent/15 text-accent",
    },
    reserved: {
        label: "Réservée",
        className: "bg-accent/15 text-accent",
    },
    active: {
        label: "En ligne",
        className: "bg-primary/15 text-primary",
    },
    expired: {
        label: "Expirée",
        className: "bg-secondary/40 text-muted-foreground",
    },
    removed: {
        label: "Retirée",
        className: "bg-secondary/40 text-muted-foreground",
    },
    sold: {
        label: "Vendue",
        className: "bg-foreground/10 text-foreground",
    },
};

function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString("fr-BE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
    });
}

export default async function MyMarketplaceListingsPage() {
    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Pas de seller_account → on oriente vers la création de compte vendeur
    const {data: sellerAccount} = await supabase
        .from("marketplace_seller_accounts")
        .select("kyc_status")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!sellerAccount) {
        redirect("/profil/marketplace/compte-vendeur");
    }

    const listings = await getMyListings();
    const kycVerified = sellerAccount.kyc_status === "verified";

    return (
        <div className="space-y-12">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Marketplace
                    </p>
                    <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                        Mes annonces
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                        {listings.length === 0
                            ? "Aucune annonce pour le moment."
                            : `${listings.length} ${
                                listings.length === 1 ? "annonce" : "annonces"
                            } au total.`}
                    </p>
                </div>

                <Link
                    href="/profil/marketplace/annonces/nouvelle"
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium"
                >
                    + Nouvelle annonce
                </Link>
            </div>

            {/* Bandeau KYC */}
            {!kycVerified && (
                <div className="border border-accent/30 bg-accent/5 p-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                        KYC non finalisé
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">
                        Tu peux préparer tes annonces en brouillon, mais il faut compléter
                        ton{" "}
                        <Link
                            href="/profil/marketplace/compte-vendeur"
                            className="text-accent underline hover:no-underline"
                        >
                            KYC vendeur
                        </Link>{" "}
                        avant de pouvoir les publier.
                    </p>
                </div>
            )}

            {/* Liste */}
            {listings.length === 0 ? (
                <div className="border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        Aucune annonce pour le moment.
                    </p>
                    <Link
                        href="/profil/marketplace/annonces/nouvelle"
                        className="mt-4 inline-block text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                    >
                        Créer ma première annonce →
                    </Link>
                </div>
            ) : (
                <ul className="divide-y divide-border border-y border-border">
                    {listings.map((listing) => {
                        const firstPhoto = listing.photos[0];
                        const photoUrl = firstPhoto
                            ? getMarketplacePublicUrl(firstPhoto.storage_path)
                            : null;
                        const status =
                            STATUS_LABELS[listing.status as MarketplaceListingStatus];

                        return (
                            <li
                                key={listing.id}
                                className="py-5 grid grid-cols-1 sm:grid-cols-[6rem_1fr_auto] gap-5 items-start"
                            >
                                {/* Photo */}
                                {photoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={photoUrl}
                                        alt={listing.title}
                                        className="h-24 w-24 flex-shrink-0 object-cover border border-border"
                                    />
                                ) : (
                                    <div
                                        className="h-24 w-24 flex-shrink-0 border border-border bg-secondary/40 flex items-center justify-center">
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                            Sans photo
                                        </span>
                                    </div>
                                )}

                                {/* Contenu */}
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-baseline gap-3">
                                        <h2 className="font-display text-lg tracking-tight leading-tight truncate">
                                            {listing.title}
                                        </h2>
                                        <span
                                            className={`text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 ${status.className}`}
                                        >
                                            {status.label}
                                        </span>
                                    </div>

                                    <div
                                        className="mt-2 flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
                                        <span className="font-display text-base text-foreground tracking-tight">
                                            {formatPrice(listing.price_cents)}
                                        </span>
                                        {listing.brand && (
                                            <>
                                                <span className="text-border">·</span>
                                                <span>{listing.brand.name}</span>
                                            </>
                                        )}
                                        {listing.category && (
                                            <>
                                                <span className="text-border">·</span>
                                                <span>{listing.category.name_fr}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="sm:pl-2">
                                    <ListingActions
                                        listingId={listing.id}
                                        status={listing.status as MarketplaceListingStatus}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}