import Link from "next/link";
import { LieuCard } from "@/components/sente/lieu-card";
import type { Lieu } from "@/lib/schemas/lieu";

export function LieuxAlaUne({ lieux }: { lieux: Lieu[] }) {
    return (
        <section className="bg-secondary/40 py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 sm:mb-16">
                    <div className="space-y-3 max-w-xl">
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Étangs à la une
                        </p>
                        <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                            Les meilleurs spots de Wallonie et de France.
                        </h2>
                    </div>

                    <Link
                        href="/lieux"
                        className="text-sm font-medium tracking-wide uppercase border-b border-foreground pb-1 hover:text-primary hover:border-primary transition-colors self-start lg:self-auto"
                    >
                        Voir tous les étangs →
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lieux.map((lieu) => (
                        <LieuCard key={lieu.id} lieu={lieu} />
                    ))}
                </div>
            </div>
        </section>
    );
}