import { Suspense } from "react";
import { getMagasins } from "@/lib/data/magasins";
import { PaysSchema, ProvinceSchema } from "@/lib/schemas/lieu";
import { SpecialiteSchema } from "@/lib/schemas/magasin";
import { MagasinCard } from "@/components/sente/magasin-card";
import { FiltersBarMagasins } from "@/components/sente/filters-bar-magasins";

type SearchParams = Promise<{
    pays?: string;
    specialite?: string;
    province?: string;
    partenaire?: string;
}>;

export const metadata = {
    title: "Tous les magasins — Sente",
    description:
        "L'annuaire des magasins de pêche en Wallonie et en France. Indépendants, généralistes, spécialistes mouche ou carpe.",
};

export default async function MagasinsPage({
                                               searchParams,
                                           }: {
    searchParams: SearchParams;
}) {
    const params = await searchParams;

    const pays = PaysSchema.safeParse(params.pays).data;
    const specialite = SpecialiteSchema.safeParse(params.specialite).data;
    const province = ProvinceSchema.safeParse(params.province).data;
    const partenaireOnly = params.partenaire === "1" ? true : undefined;

    const magasins = await getMagasins({
        pays,
        specialite,
        province,
        partenaireOnly,
    });

    return (
        <>
            <section className="bg-background pt-32 pb-12 sm:pt-40 sm:pb-16 border-b border-border">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Annuaire
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl sm:text-6xl tracking-tight leading-[0.95]">
                        Magasins de pêche
                    </h1>
                    <p className="mt-6 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-2xl">
                        Indépendants, généralistes, spécialistes carpe ou mouche. Les
                        enseignes qui font la pêche en Wallonie et en France.
                    </p>
                </div>
            </section>

            <Suspense fallback={<FiltersBarSkeleton />}>
                <FiltersBarMagasins />
            </Suspense>

            <section className="bg-background py-12 sm:py-16">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                    {magasins.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <>
                            <p className="text-sm text-muted-foreground mb-8">
                                {magasins.length} magasin{magasins.length > 1 ? "s" : ""}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {magasins.map((m) => (
                                    <MagasinCard key={m.id} magasin={m} />
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
            <p className="font-display text-2xl">Aucun magasin ne correspond.</p>
            <p className="mt-3 text-muted-foreground text-sm max-w-md mx-auto">
                Essayez d&apos;élargir vos filtres ou de réinitialiser la recherche.
            </p>
        </div>
    );
}