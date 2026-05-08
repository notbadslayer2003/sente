import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMarketplaceListingForPublic } from "@/lib/dal/marketplace-listings";
import { getMarketplacePublicUrl } from "@/lib/storage/marketplace-r2";
import {
    buildListingUrl,
    extractListingId,
} from "@/lib/marketplace/listing-url";
import { MarketplacePhotoGallery } from "@/components/sente/marketplace-photo-gallery";
import { MarketplaceListingBuyerActions } from "@/components/sente/marketplace-listing-buyer-actions";
import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Page : /marketplace/[slugid]
// =============================================================================
// slugid = "ma-canne-carpe-{uuid}". On extrait l'UUID, on charge le listing,
// et si l'URL ne correspond pas au slug canonique on redirige (SEO).
// =============================================================================

const CONDITION_LABELS: Record<string, string> = {
    new_with_tag: "Neuf avec étiquette",
    new: "Neuf sans étiquette",
    very_good: "Très bon état",
    good: "Bon état",
    acceptable: "Correct",
};

const COUNTRY_LABELS: Record<string, string> = {
    BE: "Belgique",
    FR: "France",
};

const ATTR_LABELS: Record<string, string> = {
    longueur_m: "Longueur",
    puissance_lbs: "Puissance",
    puissance_g: "Puissance grammage",
    action: "Action",
    nb_brins: "Nombre de brins",
    taille: "Taille",
    lateralite: "Latéralité",
    ratio: "Ratio",
    type_frein: "Type de frein",
    type: "Type",
    diametre_mm: "Diamètre",
    resistance_kg: "Résistance",
    couleur: "Couleur",
    avec_ardillon: "Avec ardillon",
    poids_g: "Poids",
    longueur_cm: "Longueur",
    couleur_dominante: "Couleur dominante",
    nb_detecteurs: "Nombre de détecteurs",
    sans_fil: "Sans fil",
    type_sondeur: "Type de sondeur",
    portee_m: "Portée",
    nb_places: "Nombre de places",
    hivernale: "Hivernale",
    poids_kg: "Poids",
};

const ATTR_UNITS: Record<string, string> = {
    longueur_m: " m",
    puissance_lbs: " lbs",
    diametre_mm: " mm",
    resistance_kg: " kg",
    poids_g: " g",
    longueur_cm: " cm",
    portee_m: " m",
    poids_kg: " kg",
};

function formatAttrValue(key: string, value: unknown): string {
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    const unit = ATTR_UNITS[key] ?? "";
    return `${String(value)}${unit}`;
}

function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString("fr-BE", {
        style: "currency",
        currency: "EUR",
    });
}

export default async function ListingDetailPage({
                                                    params,
                                                }: {
    params: Promise<{ slugid: string }>;
}) {
    const { slugid } = await params;
    const id = extractListingId(slugid);
    if (!id) notFound();

    const listing = await getMarketplaceListingForPublic(id);
    if (!listing) notFound();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const isOwnListing = user?.id === listing.seller_user_id;
    const isReserved = listing.status === "reserved";

    // Redirect vers slug canonique si le titre a changé (SEO)
    const canonicalUrl = buildListingUrl(listing);
    if (`/marketplace/${slugid}` !== canonicalUrl) {
        redirect(canonicalUrl);
    }

    const photosWithUrls = listing.photos.map((p) => ({
        id: p.id,
        url: getMarketplacePublicUrl(p.storage_path),
    }));

    const attributes = (listing.attributes ?? {}) as Record<string, unknown>;
    const attributeEntries = Object.entries(attributes);

    return (
        <div className="space-y-8">
            {/* Breadcrumb */}
            <Link
                href="/marketplace"
                className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors"
            >
                ← Retour au marketplace
            </Link>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr]">
                {/* Colonne gauche : photos */}
                <div>
                    <MarketplacePhotoGallery
                        photos={photosWithUrls}
                        alt={listing.title}
                    />
                </div>

                {/* Colonne droite : infos + actions */}
                <div className="space-y-8">
                    {/* Titre + prix */}
                    <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Marketplace
                            {listing.category && (
                                <>
                                    <span className="mx-2 text-border">·</span>
                                    {listing.category.name_fr}
                                </>
                            )}
                        </p>
                        <h1 className="mt-3 font-display text-3xl tracking-tight leading-[1.1]">
                            {listing.title}
                        </h1>
                        <p className="mt-4 font-display text-4xl tracking-tight">
                            {formatPrice(listing.price_cents)}
                        </p>
                        <p className="mt-3 text-xs text-muted-foreground">
                            {CONDITION_LABELS[listing.condition] ?? listing.condition}
                            {listing.brand && (
                                <>
                                    <span className="mx-1.5 text-border">·</span>
                                    {listing.brand.name}
                                </>
                            )}
                        </p>
                    </div>

                    {/* CTA buyer */}
                    {!user && (
                        <Link
                            href={`/login?next=/marketplace/${slugid}`}
                            className="block w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors py-3 text-center text-xs uppercase tracking-wide font-medium"
                        >
                            Se connecter pour acheter →
                        </Link>
                    )}

                    {user && isOwnListing && (
                        <Link
                            href={`/profil/marketplace/annonces/${listing.id}`}
                            className="block w-full border border-border hover:border-foreground transition-colors py-3 text-center text-xs uppercase tracking-wide font-medium"
                        >
                            Modifier mon annonce →
                        </Link>
                    )}

                    {user && !isOwnListing && (
                        <MarketplaceListingBuyerActions
                            listingId={listing.id}
                            priceCents={listing.price_cents}
                            disabled={isReserved}
                            disabledReason={
                                isReserved
                                    ? "Annonce réservée par un autre acheteur"
                                    : undefined
                            }
                        />
                    )}

                    {/* Vendeur */}
                    <div className="border border-border bg-secondary/20 p-5">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                            Vendu par
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                            {listing.seller?.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={listing.seller.avatar_url}
                                    alt={listing.seller.full_name ?? "Vendeur"}
                                    className="h-10 w-10 rounded-full bg-secondary/40 border border-border object-cover"
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-full bg-secondary/40 border border-border" />
                            )}
                            <p className="text-sm">
                                {listing.seller?.full_name ?? "Vendeur particulier"}
                            </p>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <h2 className="font-display text-xl tracking-tight">
                            Description
                        </h2>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                            {listing.description}
                        </p>
                    </div>

                    {/* Détails */}
                    <div>
                        <h2 className="font-display text-xl tracking-tight">Détails</h2>
                        <dl className="mt-3 divide-y divide-border border-y border-border">
                            <DescItem label="Catégorie" value={listing.category?.name_fr} />
                            <DescItem label="Marque" value={listing.brand?.name} />
                            <DescItem
                                label="État"
                                value={CONDITION_LABELS[listing.condition]}
                            />
                            <DescItem label="Poids" value={`${listing.weight_grams} g`} />
                            {listing.length_cm &&
                                listing.width_cm &&
                                listing.depth_cm && (
                                    <DescItem
                                        label="Dimensions"
                                        value={`${listing.length_cm} × ${listing.width_cm} × ${listing.depth_cm} cm`}
                                    />
                                )}
                            <DescItem
                                label="Localisation"
                                value={`${listing.city}, ${COUNTRY_LABELS[listing.country] ?? listing.country}`}
                            />
                        </dl>
                    </div>

                    {/* Caractéristiques spécifiques */}
                    {attributeEntries.length > 0 && (
                        <div>
                            <h2 className="font-display text-xl tracking-tight">
                                Caractéristiques
                            </h2>
                            <dl className="mt-3 divide-y divide-border border-y border-border">
                                {attributeEntries.map(([key, value]) => (
                                    <DescItem
                                        key={key}
                                        label={ATTR_LABELS[key] ?? key}
                                        value={formatAttrValue(key, value)}
                                    />
                                ))}
                            </dl>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DescItem({
                      label,
                      value,
                  }: {
    label: string;
    value: string | undefined | null;
}) {
    if (!value) return null;
    return (
        <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground self-center">
                {label}
            </dt>
            <dd className="text-right text-sm">{value}</dd>
        </div>
    );
}