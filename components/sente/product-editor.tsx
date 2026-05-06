"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductDetail } from "@/lib/dal/products";
import type { ProductCategoryFlat } from "@/lib/dal/product-categories";
import { ProductEditorHeader } from "@/components/sente/product-editor-header";
import { ProductInfoSection } from "@/components/sente/product-info-section";
import { ProductVariantsSection } from "@/components/sente/product-variants-section";
import { ProductPhotosSection } from "@/components/sente/product-photos-section";

export type ProductEditorGates = {
    canPublish: boolean;
    publishReason: string | null;
    canAddPhoto: boolean;
    addPhotoReason: string | null;
    canUseVariants: boolean;
    variantsReason: string | null;
};

type Props = {
    slug: string;
    product: ProductDetail;
    categories: ProductCategoryFlat[];
    gates: ProductEditorGates;
};

export function ProductEditor({ slug, product, categories, gates }: Props) {
    const router = useRouter();

    // Sections déployées (multi-open)
    const [openSections, setOpenSections] = useState<Set<string>>(
        new Set(["info", "variants"])
    );

    const toggleSection = (key: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <div className="space-y-6">
            <ProductEditorHeader
                slug={slug}
                product={product}
                onMutated={() => router.refresh()}
                canPublish={gates.canPublish}
                publishReason={gates.publishReason}
            />

            {/* Section : Informations */}
            <Accordion
                title="Informations"
                description="Nom, catégorie, descriptions, marque, tags."
                isOpen={openSections.has("info")}
                onToggle={() => toggleSection("info")}
            >
                <ProductInfoSection
                    product={product}
                    categories={categories}
                    onSaved={() => router.refresh()}
                />
            </Accordion>

            {/* Section : Variantes */}
            <Accordion
                title="Variantes"
                description="Prix, stock, SKU, options. Au moins une variante requise pour publier."
                isOpen={openSections.has("variants")}
                onToggle={() => toggleSection("variants")}
                badge={`${product.variants.length}`}
            >
                <ProductVariantsSection
                    product={product}
                    onMutated={() => router.refresh()}
                    canUseVariants={gates.canUseVariants}
                    variantsReason={gates.variantsReason}
                    slug={slug}
                />
            </Accordion>

            {/* Section : Photos */}
            <Accordion
                title="Photos"
                description="Au moins 1 photo requise pour publier."
                isOpen={openSections.has("photos")}
                onToggle={() => toggleSection("photos")}
                badge={`${product.photos.length}`}
            >
                <ProductPhotosSection
                    product={product}
                    onMutated={() => router.refresh()}
                    canAddPhoto={gates.canAddPhoto}
                    addPhotoReason={gates.addPhotoReason}
                    slug={slug}
                />
            </Accordion>
        </div>
    );
}

function Accordion({
                       title,
                       description,
                       badge,
                       isOpen,
                       onToggle,
                       disabled,
                       children,
                   }: {
    title: string;
    description: string;
    badge?: string;
    isOpen: boolean;
    onToggle: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="border border-border">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-secondary/20 transition-colors"
                disabled={disabled}
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <h3 className="font-display text-lg tracking-tight">{title}</h3>
                        {badge !== undefined && (
                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-secondary text-muted-foreground">
                                {badge}
                            </span>
                        )}
                        {disabled && (
                            <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-muted text-muted-foreground/60">
                                Bientôt
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
                <span className="text-muted-foreground text-sm">
                    {isOpen ? "−" : "+"}
                </span>
            </button>
            {isOpen && !disabled && (
                <div className="border-t border-border p-5">{children}</div>
            )}
        </div>
    );
}