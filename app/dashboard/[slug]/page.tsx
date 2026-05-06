import Link from "next/link";
import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import { SubmitOrgButton } from "@/components/sente/submit-org-button";
import {
    getStockAlertCounts,
    getStockAlertProducts,
} from "@/lib/dal/products";
import { StockAlertsCard } from "@/components/sente/stock-alerts-card";

type Params = Promise<{ slug: string }>;

export default async function DashboardOverviewPage({
                                                        params,
                                                    }: {
    params: Params;
}) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    const supabase = await createClient();
    const { data: org } = await supabase
        .from("organizations")
        .select(
            "description, address, contact_email, contact_phone, photos, cover_image_url"
        )
        .eq("id", ctx.org.id)
        .single();

    let completion = 0;
    let totalChecks = 0;
    const checks = {
        description: !!org?.description && org.description.length >= 50,
        address: !!org?.address,
        contact: !!(org?.contact_email || org?.contact_phone),
        cover: !!org?.cover_image_url,
        gallery: (org?.photos?.length ?? 0) >= 1,
    };
    if (org) {
        const allChecks = Object.values(checks);
        completion = Math.round(
            (allChecks.filter(Boolean).length / allChecks.length) * 100
        );
        totalChecks = allChecks.length;
    }

    const minimalReady = checks.description && checks.address && checks.contact;
    const submittable = minimalReady && ctx.org.status === "draft";

    // Stock alerts (uniquement pour magasins actifs avec produits)
    const showStockAlerts =
        ctx.org.org_type === "magasin" && ctx.org.status === "active";

    const [stockCounts, stockProducts] = showStockAlerts
        ? await Promise.all([
            getStockAlertCounts(ctx.org.id),
            getStockAlertProducts(ctx.org.id, 20),
        ])
        : [null, []];

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Vue d&apos;ensemble
                </p>
                <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                    Bienvenue dans ton espace.
                </h1>
            </div>

            {ctx.org.status === "draft" && (
                <div className="border border-border bg-secondary/30 p-8">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Avancement de la fiche
                    </p>
                    <div className="mt-4 flex items-baseline gap-3">
                        <span className="font-display-soft text-5xl tracking-tight">
                            {completion}%
                        </span>
                        <span className="text-sm text-muted-foreground">
                            ({totalChecks} étapes)
                        </span>
                    </div>
                    <div className="mt-4 h-1 bg-border overflow-hidden">
                        <div
                            className="h-full bg-accent transition-all"
                            style={{ width: `${completion}%` }}
                        />
                    </div>

                    <ul className="mt-6 space-y-2 text-sm">
                        <CheckItem
                            done={checks.description}
                            label="Description (50+ caractères)"
                        />
                        <CheckItem done={checks.address} label="Adresse" />
                        <CheckItem
                            done={checks.contact}
                            label="Email ou téléphone de contact"
                        />
                        <CheckItem done={checks.cover} label="Photo de couverture" />
                        <CheckItem
                            done={checks.gallery}
                            label="Au moins une photo de galerie"
                        />
                    </ul>

                    <div className="mt-8 flex flex-wrap gap-4 items-start">
                        <Link
                            href={`/dashboard/${ctx.org.slug}/fiche`}
                            className="inline-flex items-center justify-center border border-foreground hover:bg-foreground hover:text-background transition-colors px-6 py-3 text-sm font-medium tracking-wide uppercase"
                        >
                            Compléter la fiche
                        </Link>
                        {submittable && <SubmitOrgButton orgId={ctx.org.id} />}
                    </div>

                    {!minimalReady && (
                        <p className="mt-4 text-xs text-muted-foreground">
                            Le bouton « Soumettre » apparaît dès que description, adresse et
                            contact sont remplis.
                        </p>
                    )}
                </div>
            )}

            {ctx.org.status === "pending_review" && (
                <div className="border border-accent/30 bg-accent/5 p-8">
                    <p className="font-display text-xl">
                        En validation par l&apos;équipe Sente.
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                        Ta fiche est en cours de revue. Elle sera publiée dès validation.
                        Tu peux continuer à l&apos;éditer en attendant.
                    </p>
                </div>
            )}

            {ctx.org.status === "active" && (
                <div className="border border-primary/30 bg-primary/5 p-8">
                    <p className="font-display text-xl">Ta fiche est en ligne.</p>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                        Elle est visible publiquement sur Sente.
                    </p>
                    <div className="mt-6">
                        <Link
                            href={
                                ctx.org.org_type === "etang"
                                    ? `/lieux/${ctx.org.slug}`
                                    : `/magasins/${ctx.org.slug}`
                            }
                            className="text-sm uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                        >
                            Voir ma fiche publique →
                        </Link>
                    </div>
                </div>
            )}

            {/* Alertes stock — magasin actif uniquement */}
            {showStockAlerts && stockCounts && (
                <StockAlertsCard
                    slug={slug}
                    counts={stockCounts}
                    products={stockProducts}
                />
            )}
        </div>
    );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
    return (
        <li className="flex items-center gap-3">
            <span
                className={`w-4 h-4 flex items-center justify-center text-[10px] ${
                    done
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground"
                }`}
            >
                {done ? "✓" : ""}
            </span>
            <span className={done ? "" : "text-muted-foreground"}>{label}</span>
        </li>
    );
}