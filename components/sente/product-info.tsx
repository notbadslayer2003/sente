import Link from "next/link";
import type { ShopSettings } from "@/lib/dal/shop-settings";
import { formatPriceEur } from "@/lib/utils/format";

type Props = {
    fullDesc: string | null;
    tags: string[];
    organization: {
        id: string;
        slug: string;
        name: string;
    };
    shopSettings: ShopSettings;
};

export function ProductInfo({
                                fullDesc,
                                tags,
                                organization,
                                shopSettings,
                            }: Props) {
    const hasShipping =
        shopSettings.click_collect_enabled ||
        shopSettings.shipping_standard_enabled ||
        shopSettings.shipping_local_enabled;

    return (
        <div className="space-y-6">
            {/* Description complète */}
            {fullDesc && (
                <div className="space-y-2">
                    <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        Description
                    </h3>
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                        {fullDesc}
                    </p>
                </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((t) => (
                            <span
                                key={t}
                                className="px-2 py-1 text-xs bg-secondary text-muted-foreground"
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Modes de récupération */}
            {hasShipping && (
                <div className="space-y-3 pt-4 border-t border-border">
                    <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        Récupération
                    </h3>
                    <ul className="space-y-2 text-sm">
                        {shopSettings.click_collect_enabled && (
                            <li className="flex items-start gap-3">
                                <span className="text-accent mt-0.5">•</span>
                                <div>
                                    <p>Retrait en magasin</p>
                                    <p className="text-xs text-muted-foreground">
                                        Gratuit. Tu seras prévenu(e) quand ta commande
                                        est prête.
                                    </p>
                                </div>
                            </li>
                        )}
                        {shopSettings.shipping_standard_enabled && (
                            <li className="flex items-start gap-3">
                                <span className="text-accent mt-0.5">•</span>
                                <div>
                                    <p>Livraison standard</p>
                                    <p className="text-xs text-muted-foreground">
                                        Par transporteur. Frais calculés au checkout selon le poids et l&apos;adresse de livraison.
                                    </p>
                                </div>
                            </li>
                        )}
                        {shopSettings.shipping_local_enabled && (
                            <li className="flex items-start gap-3">
                                <span className="text-accent mt-0.5">•</span>
                                <div>
                                    <p>Livraison locale</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatPriceEur(
                                            shopSettings.shipping_local_fee_cents,
                                            { showFree: true }
                                        )}
                                        {shopSettings.shipping_local_zone_desc && (
                                            <> — {shopSettings.shipping_local_zone_desc}</>
                                        )}
                                    </p>
                                </div>
                            </li>
                        )}
                    </ul>
                </div>
            )}

            {/* Vendeur */}
            <div className="pt-4 border-t border-border">
                <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">
                    Vendu par
                </h3>
                <Link
                    href={`/magasins/${organization.slug}`}
                    className="inline-flex items-center gap-2 text-sm hover:text-accent transition-colors"
                >
                    <span>{organization.name}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                </Link>
            </div>
        </div>
    );
}