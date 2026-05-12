import { getMarketplacePublicListings } from "@/lib/dal/marketplace-listings";
import { getMarketplacePublicUrl } from "@/lib/storage/marketplace-r2";
import { buildListingUrl } from "@/lib/marketplace/listing-url";
import {
    MarketCarouselClient,
    type MarketCarouselItem,
} from "./market-carousel-client";

// ============================================================
// MarketCarousel — Server Component
//
// Section "Ce qui vient d'être déposé par la communauté" sur la home.
// Port fidèle du <MarketCarousel /> du design Claude (sente.jsx).
//
// Responsabilités ici :
// - Fetch des 10 dernières annonces via DAL existante
// - Mapping Listing (forme DAL) → MarketCarouselItem (forme rendu)
//   On fait le mapping côté server pour éviter de pousser la logique
//   storage URL / URL builder / format de prix vers le client.
// - Rendu d'un fallback null si aucune annonce (pas de section vide)
//
// La DAL retourne probablement plus de 10 items par défaut (pageSize ≥ 24).
// On slice(0, 10) après fetch. Optimisation possible plus tard :
// ajouter un param `limit` à getMarketplacePublicListings pour ne pas
// over-fetch sur la home.
// ============================================================

const CONDITION_LABELS: Record<string, string> = {
    new_with_tag: "Neuf avec étiquette",
    new: "Neuf",
    very_good: "Très bon",
    good: "Bon état",
    acceptable: "Correct",
};

function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString("fr-BE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
    });
}

export async function MarketCarousel() {
    const { items } = await getMarketplacePublicListings({
        sort: "recent",
        page: 1,
    });

    const carouselItems: MarketCarouselItem[] = items.slice(0, 10).map((listing) => {
        const firstPhoto = listing.photos[0];
        const photoUrl = firstPhoto
            ? getMarketplacePublicUrl(firstPhoto.storage_path)
            : null;

        // Eyebrow secondaire : on privilégie la marque (info la plus discriminante
        // dans un contexte marketplace pêche : "Daiwa", "Preston"...) sinon on
        // tombe sur la condition humanisée.
        const eyebrowLeft =
            listing.brand?.name ??
            CONDITION_LABELS[listing.condition] ??
            listing.condition;

        return {
            id: listing.id,
            href: buildListingUrl(listing),
            title: listing.title,
            priceLabel: formatPrice(listing.price_cents),
            city: listing.city,
            eyebrowLeft,
            photoUrl,
            stateLabel:
                CONDITION_LABELS[listing.condition] ?? listing.condition,
        };
    });

    // Aucune annonce active → on cache la section plutôt que d'afficher un
    // empty state moche en home (le design n'en prévoit pas).
    if (carouselItems.length === 0) {
        return null;
    }

    return <MarketCarouselClient items={carouselItems} />;
}