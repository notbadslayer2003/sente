// =============================================================================
// Helpers URL pour les listings publics du marketplace
// =============================================================================
// Pattern : /marketplace/[slug]-[uuid]
// On extrait l'UUID en fin de chaîne (toujours présent), le slug avant n'est
// que cosmétique (SEO + lisibilité). Si le slug ne matche plus le titre actuel
// (parce que le vendeur a édité le titre), la page redirige vers l'URL canonique.
// =============================================================================

const UUID_AT_END =
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function slugify(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

export function buildListingUrl(listing: {
    id: string;
    title: string;
}): string {
    const slug = slugify(listing.title);
    return slug
        ? `/marketplace/${slug}-${listing.id}`
        : `/marketplace/${listing.id}`;
}

/**
 * Extrait l'UUID en fin de slugid. Retourne null si pas d'UUID valide.
 */
export function extractListingId(slugid: string): string | null {
    const match = slugid.match(UUID_AT_END);
    return match ? match[1].toLowerCase() : null;
}