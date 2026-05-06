"use client";

import { useState, useMemo } from "react";
import type { ProductDetail, ProductVariant } from "@/lib/dal/products";
import type { ShopSettings } from "@/lib/dal/shop-settings";
import { ProductGallery } from "@/components/sente/product-gallery";
import { VariantSelector } from "@/components/sente/variant-selector";
import { ProductActions } from "@/components/sente/product-actions";
import { ProductInfo } from "@/components/sente/product-info";

type Props = {
    product: ProductDetail;
    shopSettings: ShopSettings;
};

export function ProductDetailClient({ product, shopSettings }: Props) {
    // Variantes actives uniquement
    const activeVariants = useMemo(
        () => product.variants.filter((v) => v.is_active),
        [product.variants]
    );

    // Variante par défaut : première active disponible (en stock ou illimitée)
    const defaultVariant = useMemo<ProductVariant | null>(() => {
        const inStock = activeVariants.find(
            (v) => v.stock_quantity === null || v.stock_quantity > 0
        );
        return inStock ?? activeVariants[0] ?? null;
    }, [activeVariants]);

    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
        defaultVariant?.id ?? null
    );

    /**
     * Dimensions à afficher dans le sélecteur :
     * - Si variant_dimensions est défini explicitement → on l'utilise tel quel
     * - Sinon (cas gift_card), on dérive depuis les clés des options des variantes
     *   (ex: pour gift_card → ["Valeur"])
     */
    const effectiveDimensions = useMemo(() => {
        if (product.variant_dimensions.length > 0) {
            return product.variant_dimensions;
        }
        // Dérive l'union des clés d'options présentes sur les variantes
        const keys = new Set<string>();
        for (const v of activeVariants) {
            for (const k of Object.keys(v.options)) {
                keys.add(k);
            }
        }
        return Array.from(keys);
    }, [product.variant_dimensions, activeVariants]);

    const selectedVariant = useMemo(
        () => activeVariants.find((v) => v.id === selectedVariantId) ?? null,
        [activeVariants, selectedVariantId]
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Colonne gauche : galerie */}
            <ProductGallery
                photos={product.photos}
                productName={product.name}
            />

            {/* Colonne droite : infos + actions */}
            <div className="space-y-8">
                {/* Header produit */}
                <div className="space-y-3">
                    {product.brand && (
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            {product.brand}
                        </p>
                    )}
                    <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-tight">
                        {product.name}
                    </h1>
                    {product.short_desc && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {product.short_desc}
                        </p>
                    )}
                </div>

                {/* Variant selector */}
                {effectiveDimensions.length > 0 && activeVariants.length > 1 && (
                    <VariantSelector
                        dimensions={effectiveDimensions}
                        variants={activeVariants}
                        selectedVariantId={selectedVariantId}
                        onSelect={setSelectedVariantId}
                    />
                )}

                {/* Actions : prix + qty + bouton */}
                <ProductActions
                    variant={selectedVariant}
                    productOrgSlug={product.organization.slug}
                    productSlug={product.slug}
                />

                {/* Modes de récupération + descriptif vendeur */}
                <ProductInfo
                    fullDesc={product.full_desc}
                    tags={product.tags}
                    organization={product.organization}
                    shopSettings={shopSettings}
                />
            </div>
        </div>
    );
}