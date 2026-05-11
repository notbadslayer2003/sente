import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyMarketplaceSellerAccount } from "@/lib/dal/marketplace-seller-account";
import { MarketplaceKycForm } from "@/components/sente/marketplace-kyc-form";
import { refreshKycStatus } from "@/app/actions/marketplace/seller-kyc";
import {MarketplaceShippingAddressForm} from "@/components/sente/marketplace-shipping-address-form";

interface PageProps {
    searchParams: Promise<{ status?: string }>;
}

export default async function MarketplaceKycPage({ searchParams }: PageProps) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login?next=/profil/marketplace/compte-vendeur");
    }

    // Retour de Stripe (status=success ou refresh) : force un refresh d'état
    // avant rendu — le webhook peut être lent et l'user voit son statut updaté.
    const params = await searchParams;
    if (params.status === "success" || params.status === "refresh") {
        await refreshKycStatus();
    }

    const account = await getMyMarketplaceSellerAccount();

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Marketplace
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Compte vendeur
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Pour vendre sur le marketplace, tu dois compléter ton identification
                    via Stripe (KYC). C&apos;est obligatoire avant de publier ta première
                    annonce et de recevoir des paiements.
                </p>
            </div>

            <MarketplaceKycForm account={account} />

            {/* Adresse d'expédition — visible uniquement après KYC validé */}
            {account?.kyc_status === "verified" && (
                <div className="border-t border-border pt-12">
                    <MarketplaceShippingAddressForm account={account} />
                </div>
            )}
        </div>
    );
}