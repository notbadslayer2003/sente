import Image from "next/image";
import Link from "next/link";
import type { ProductListItem } from "@/lib/dal/products";
import {
    formatPriceEur,
    formatPriceRangeEur,
} from "@/lib/utils/format";

type Props = {
    product: ProductListItem;
    orgSlug: string;
};

export function ProductCard({ product, orgSlug }: Props) {
    const cover = product.photos[0];
    const hasDiscount =
        product.variants_count > 0 &&
        product.min_price_cents !== product.max_price_cents;

    return (
        <Link
            href={`/magasins/${orgSlug}/boutique/${product.slug}`}
            className="group block"
        >
            <div className="relative aspect-square overflow-hidden bg-secondary/30 border border-border group-hover:border-accent transition-colors">
                {cover ? (
                    <Image
                        src={cover}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            Pas d'image
                        </span>
                    </div>
                )}

                {/* Badge rupture (overlay) */}
                {!product.has_stock && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <span className="px-3 py-1.5 text-[10px] uppercase tracking-wide bg-destructive text-destructive-foreground">
                            Rupture
                        </span>
                    </div>
                )}
            </div>

            <div className="mt-4 space-y-1.5">
                {product.brand && (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {product.brand}
                    </p>
                )}

                <h3 className="text-sm font-medium leading-snug group-hover:text-accent transition-colors">
                    {product.name}
                </h3>

                {product.short_desc && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {product.short_desc}
                    </p>
                )}

                <p className="pt-1 text-sm font-medium">
                    {hasDiscount
                        ? formatPriceRangeEur(
                            product.min_price_cents,
                            product.max_price_cents
                        )
                        : formatPriceEur(product.min_price_cents, {
                            showFree: false,
                        })}
                </p>

                {product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                        {product.tags.slice(0, 3).map((t) => (
                            <span
                                key={t}
                                className="px-1.5 py-0.5 text-[9px] uppercase tracking-wide bg-secondary text-muted-foreground"
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </Link>
    );
}