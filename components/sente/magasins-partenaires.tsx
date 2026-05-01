"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MagasinCard } from "@/components/sente/magasin-card";
import type { Magasin } from "@/lib/schemas/magasin";

export function MagasinsPartenaires({
                                        peche,
                                        chasse,
                                    }: {
    peche: Magasin[];
    chasse: Magasin[];
}) {
    return (
        <section className="bg-background py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <Tabs defaultValue="peche" className="flex flex-col w-full">
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 sm:mb-16">
                        <div className="space-y-3 max-w-xl">
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                Magasins partenaires
                            </p>
                            <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                                Les enseignes qui font la différence.
                            </h2>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                            <TabsList className="bg-secondary/40 border border-border h-auto p-1">
                                <TabsTrigger
                                    value="peche"
                                    className="text-xs uppercase tracking-wide px-5 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                                >
                                    Pêche
                                </TabsTrigger>
                                <TabsTrigger
                                    value="chasse"
                                    className="text-xs uppercase tracking-wide px-5 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                                >
                                    Chasse
                                </TabsTrigger>
                            </TabsList>

                            <Link
                                href="/magasins"
                                className="text-sm font-medium tracking-wide uppercase border-b border-foreground pb-1 hover:text-primary hover:border-primary transition-colors"
                            >
                                Voir tous les magasins →
                            </Link>
                        </div>
                    </div>

                    <TabsContent value="peche" className="mt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {peche.map((m) => (
                                <MagasinCard key={m.id} magasin={m} />
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="chasse" className="mt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {chasse.map((m) => (
                                <MagasinCard key={m.id} magasin={m} />
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </section>
    );
}