import Link from "next/link";
import { MagasinCard } from "@/components/sente/magasin-card";
import type { Magasin } from "@/lib/schemas/magasin";

export function MagasinsPartenaires({ magasins }: { magasins: Magasin[] }) {
    return (
        <section className="bg-background py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 sm:mb-16">
                    <div className="space-y-3 max-w-xl">
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Magasins partenaires
                        </p>
                        <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                            Les enseignes qui font la différence.
                        </h2>
                    </div>

                    <Link
                        href="/magasins"
                        className="text-sm font-medium tracking-wide uppercase border-b border-foreground pb-1 hover:text-primary hover:border-primary transition-colors self-start lg:self-auto"
                    >
                        Voir tous les magasins →
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {magasins.map((m) => (
                        <MagasinCard key={m.id} magasin={m} />
                    ))}
                </div>
            </div>
        </section>
    );
}