import { Suspense } from "react";
import { getLieux } from "@/lib/data/lieux";
import {
    EspeceSchema,
    PaysSchema,
    ProvinceSchema,
} from "@/lib/schemas/lieu";
import { LieuCard } from "@/components/sente/lieu-card";
import { FiltersBar } from "@/components/sente/filters-bar";

type SearchParams = Promise<{
    pays?: string;
    espece?: string;
    province?: string;
    reservable?: string;
}>;

export const metadata = {
    title: "Tous les étangs — Sente",
    description:
        "L'annuaire des étangs de pêche en Wallonie et en France. Filtrez par espèce, province ou disponibilité.",
};

export default async function LieuxPage({
                                            searchParams,
                                        }: {
    searchParams: SearchParams;
}) {
    const params = await searchParams;

    // Parse safe : si la query string contient n'importe quoi, on ignore
    const pays = PaysSchema.safeParse(params.pays).data;
    const espece = EspeceSchema.safeParse(params.espece).data;
    const province = ProvinceSchema.safeParse(params.province).data;
    const reservableOnly = params.reservable === "1" ? true : undefined;

    const lieux = await getLieux({ pays, espece, province, reservableOnly });

    return (
        <>
            {/* Header de page */}
            <section className="bg-background pt-32 pb-12 sm:pt-40 sm:pb-16 border-b border-border">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Annuaire
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl sm:text-6xl tracking-tight leading-[0.95]">
                        Étangs vérifiés
                    </h1>
                    <p className="mt-6 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl">
                        Chaque étang listé est vérifié. Wallonie, France, du carpodrome
                        privé au lac de barrage.
                    </p>
                </div>
            </section>

            <Suspense fallback={<FiltersBarSkeleton />}>
                <FiltersBar />
            </Suspense>

            <section className="bg-background py-12 sm:py-16">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                    {lieux.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground mb-8">
                                {lieux.length} étang{lieux.length > 1 ? "s" : ""}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {lieux.map((lieu) => (
                                    <LieuCard key={lieu.id} lieu={lieu} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </section>
        </>
    );
}

function FiltersBarSkeleton() {
    return (
        <div className="border-y border-border bg-secondary/30 h-[88px] animate-pulse" />
    );
}

function EmptyState() {
    return (
        <div className="text-center py-24">
            <p className="font-display text-2xl">Aucun étang ne correspond.</p>
            <p className="mt-3 text-muted-foreground text-sm max-w-md mx-auto">
                Essayez d&apos;élargir vos filtres ou de réinitialiser la recherche.
            </p>
        </div>
    );
}