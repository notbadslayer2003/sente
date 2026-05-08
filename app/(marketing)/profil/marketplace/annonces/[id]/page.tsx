import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMarketplaceCategories } from "@/lib/dal/marketplace-categories";
import { getMarketplaceVerifiedBrands } from "@/lib/dal/marketplace-brands";
import { MarketplaceListingForm } from "@/components/sente/marketplace-listing-form";
import { MarketplacePhotoUpload } from "@/components/sente/marketplace-photo-upload";

// =============================================================================
// Page : /profil/marketplace/annonces/[id]
// =============================================================================
// Édition d'une annonce. Sections :
// - Photos (composant client autonome)
// - Informations (composant form, mode edit)
// =============================================================================

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
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

export default async function EditMarketplaceListingPage({
                                                             params,
                                                         }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Charger le listing avec ses photos
    const { data: listing } = await supabase
        .from("marketplace_listings")
        .select(`
            *,
            photos:marketplace_listing_photos(id, storage_path, position)
        `)
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();

    if (!listing || listing.seller_user_id !== user.id) {
        notFound();
    }

    // Charger l'état KYC pour décider si on peut publier
    const { data: sellerAccount } = await supabase
        .from("marketplace_seller_accounts")
        .select("kyc_status, stripe_charges_enabled, stripe_payouts_enabled")
        .eq("user_id", user.id)
        .maybeSingle();

    const kycVerified =
        sellerAccount?.kyc_status === "verified" &&
        sellerAccount.stripe_charges_enabled === true &&
        sellerAccount.stripe_payouts_enabled === true;

    const photos = (listing.photos ?? []) as {
        id: string;
        storage_path: string;
        position: number;
    }[];
    const canPublish =
        listing.status === "draft" && photos.length > 0 && kycVerified;

    // Catégories (mêmes mécaniques que /nouvelle)
    const allCategories = await getMarketplaceCategories();
    const categoriesById = new Map(allCategories.map((c) => [c.id, c]));

    const hasChildren = new Set<string>();
    for (const c of allCategories) {
        if (c.parent_id) hasChildren.add(c.parent_id);
    }
    const leafCategories = allCategories
        .filter((c) => !hasChildren.has(c.id))
        .map((c) => ({
            id: c.id,
            slug: c.slug,
            name_fr: c.name_fr,
            parent_id: c.parent_id,
            parent_slug: c.parent_id
                ? categoriesById.get(c.parent_id)?.slug ?? null
                : null,
            parent_name: c.parent_id
                ? categoriesById.get(c.parent_id)?.name_fr ?? null
                : null,
        }))
        .sort((a, b) => {
            const aLabel = a.parent_name ? `${a.parent_name} ${a.name_fr}` : a.name_fr;
            const bLabel = b.parent_name ? `${b.parent_name} ${b.name_fr}` : b.name_fr;
            return aLabel.localeCompare(bLabel, "fr");
        });

    const brands = (await getMarketplaceVerifiedBrands()).map((b) => ({
        id: b.id,
        name: b.name,
    }));

    const status = STATUS_LABELS[listing.status] ?? STATUS_LABELS.draft;

    const photosDisabled =
        listing.status === "sold" ||
        listing.status === "removed" ||
        listing.status === "reserved";

    return (
        <div className="space-y-12">
            {/* Header */}
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Marketplace · Annonce
                </p>
                <div className="mt-3 flex flex-wrap items-baseline gap-4">
                    <h1 className="font-display text-4xl tracking-tight leading-[1.05]">
                        {listing.title}
                    </h1>
                    <span
                        className={`text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 ${status.className}`}
                    >
                        {status.label}
                    </span>
                </div>
            </div>

            {/* Section Photos */}
            <section className="space-y-5">
                <div>
                    <h2 className="font-display text-xl tracking-tight">Photos</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                        La première photo sera la principale. Glisse-déposes ou clique
                        pour en ajouter (max 6).
                    </p>
                </div>
                <MarketplacePhotoUpload
                    listingId={listing.id}
                    initialPhotos={photos}
                    disabled={photosDisabled}
                />
            </section>

            {/* Section Informations */}
            <section className="space-y-5">
                <h2 className="font-display text-xl tracking-tight">Informations</h2>

                {!kycVerified && listing.status === "draft" && (
                    <div className="border border-accent/30 bg-accent/5 p-5">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                            KYC non finalisé
                        </p>
                        <p className="mt-2 text-sm leading-relaxed">
                            Tu peux enregistrer ton brouillon, mais il faut compléter ton{" "}
                            <Link
                                href="/profil/marketplace/compte-vendeur"
                                className="text-accent underline hover:no-underline"
                            >
                                KYC vendeur
                            </Link>{" "}
                            avant de pouvoir publier.
                        </p>
                    </div>
                )}

                {listing.status === "draft" && photos.length === 0 && (
                    <div className="border border-accent/30 bg-accent/5 p-5">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                            Photo manquante
                        </p>
                        <p className="mt-2 text-sm leading-relaxed">
                            Ajoute au moins une photo pour pouvoir publier l&apos;annonce.
                        </p>
                    </div>
                )}

                <MarketplaceListingForm
                    mode="edit"
                    listingId={listing.id}
                    listingStatus={listing.status}
                    canPublish={canPublish}
                    initialValues={{
                        title: listing.title,
                        description: listing.description,
                        price_euros: listing.price_cents / 100,
                        category_id: listing.category_id,
                        brand_id: listing.brand_id,
                        condition: listing.condition,
                        weight_grams: listing.weight_grams,
                        length_cm: listing.length_cm,
                        width_cm: listing.width_cm,
                        depth_cm: listing.depth_cm,
                        city: listing.city,
                        postal_code: listing.postal_code,
                        country: listing.country,
                        attributes:
                            (listing.attributes as Record<string, unknown>) ?? {},
                    }}
                    categories={leafCategories}
                    brands={brands}
                />
            </section>
        </div>
    );
}