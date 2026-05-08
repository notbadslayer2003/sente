import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMarketplaceCategories } from "@/lib/dal/marketplace-categories";
import { getMarketplaceVerifiedBrands } from "@/lib/dal/marketplace-brands";
import { MarketplaceListingForm } from "@/components/sente/marketplace-listing-form";

// =============================================================================
// Page : /profil/marketplace/annonces/nouvelle
// =============================================================================
// Création d'une annonce. À la soumission, on crée un draft puis on redirige
// vers /[id] pour ajouter les photos et publier.
// =============================================================================

export default async function NewMarketplaceListingPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // S'assurer que le seller_account existe (KYC peut être pending : on
    // autorise quand même la création de draft).
    const { data: sellerAccount } = await supabase
        .from("marketplace_seller_accounts")
        .select("kyc_status")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!sellerAccount) {
        redirect("/profil/marketplace/compte-vendeur");
    }

    // Catégories : seulement les feuilles (N2) ou N1 sans enfants
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

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Marketplace · Annonces
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Nouvelle annonce
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Renseigne les informations de base. Les photos et la publication
                    se font à l&apos;étape suivante.
                </p>
            </div>

            <MarketplaceListingForm
                mode="create"
                categories={leafCategories}
                brands={brands}
            />
        </div>
    );
}