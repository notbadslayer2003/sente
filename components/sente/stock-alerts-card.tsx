import Link from "next/link";
import Image from "next/image";
import type { StockAlertProduct } from "@/lib/dal/products";

type Props = {
    slug: string;
    counts: {
        out_of_stock: number;
        low_stock: number;
        total_published: number;
    };
    products: StockAlertProduct[];
};

export function StockAlertsCard({ slug, counts, products }: Props) {
    const totalAlerts = counts.out_of_stock + counts.low_stock;

    if (totalAlerts === 0) {
        return null;
    }

    return (
        <div className="border border-border bg-secondary/10">
            <header className="flex items-center justify-between gap-4 p-5 border-b border-border">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        Stock
                    </p>
                    <h3 className="mt-1 font-display text-xl tracking-tight">
                        Alertes stock
                    </h3>
                </div>
                <div className="flex items-center gap-3">
                    {counts.out_of_stock > 0 && (
                        <span className="px-2 py-1 text-[10px] uppercase tracking-wide bg-destructive/15 text-destructive">
                            {counts.out_of_stock} en rupture
                        </span>
                    )}
                    {counts.low_stock > 0 && (
                        <span className="px-2 py-1 text-[10px] uppercase tracking-wide bg-accent/15 text-accent">
                            {counts.low_stock} stock bas
                        </span>
                    )}
                </div>
            </header>

            <ul className="divide-y divide-border">
                {products.slice(0, 5).map((product) => (
                    <li key={product.id}>
                        <Link
                            href={`/dashboard/${slug}/produits/${product.id}`}
                            className="flex items-start gap-4 p-4 hover:bg-secondary/20 transition-colors"
                        >
                            <div className="w-12 h-12 bg-secondary border border-border overflow-hidden flex-shrink-0">
                                {product.photos[0] ? (
                                    <Image
                                        src={product.photos[0]}
                                        alt={product.name}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-[8px] uppercase tracking-wide text-muted-foreground">
                                            —
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                    {product.name}
                                </p>
                                <ul className="mt-1 space-y-0.5">
                                    {product.variants_alerts
                                        .slice(0, 3)
                                        .map((v) => (
                                            <li
                                                key={v.variant_id}
                                                className="text-xs text-muted-foreground"
                                            >
                                                {v.variant_name ? `${v.variant_name} · ` : ""}
                                                <span
                                                    className={
                                                        v.stock_quantity === 0
                                                            ? "text-destructive font-medium"
                                                            : "text-accent font-medium"
                                                    }
                                                >
                                                    {v.stock_quantity === 0
                                                        ? "Rupture"
                                                        : `${v.stock_quantity} en stock`}
                                                </span>
                                            </li>
                                        ))}
                                    {product.variants_alerts.length > 3 && (
                                        <li className="text-xs text-muted-foreground italic">
                                            + {product.variants_alerts.length - 3} variante
                                            {product.variants_alerts.length - 3 > 1 ? "s" : ""}
                                        </li>
                                    )}
                                </ul>
                            </div>

                            <span className="text-xs text-muted-foreground hidden sm:inline-block">
                                →
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>

            {products.length > 5 && (
                <footer className="border-t border-border p-3 text-center">
                    <Link
                        href={`/dashboard/${slug}/produits?stock=alerts`}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-accent transition-colors"
                    >
                        Voir toutes les alertes ({products.length}) →
                    </Link>
                </footer>
            )}
        </div>
    );
}