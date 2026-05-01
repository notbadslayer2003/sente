"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LieuCard } from "@/components/sente/lieu-card";
import type { Lieu } from "@/lib/schemas/lieu";

export function LieuxAlaUne({
                                peche,
                                chasse,
                            }: {
    peche: Lieu[];
    chasse: Lieu[];
}) {
    return (
        <section className="bg-secondary/40 py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <Tabs defaultValue="peche" className="flex flex-col w-full">
                    {/* Header avec tabs alignées à droite des titres */}
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 sm:mb-16">
                        <div className="space-y-3 max-w-xl">
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                Lieux à la une
                            </p>
                            <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                                Les meilleurs spots de Wallonie.
                            </h2>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                            <TabsList className="bg-background/60 border border-border h-auto p-1">
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
                                href="/lieux"
                                className="text-sm font-medium tracking-wide uppercase border-b border-foreground pb-1 hover:text-primary hover:border-primary transition-colors"
                            >
                                Voir tous les lieux →
                            </Link>
                        </div>
                    </div>

                    <TabsContent value="peche" className="mt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {peche.map((lieu) => (
                                <LieuCard key={lieu.id} lieu={lieu} />
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="chasse" className="mt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {chasse.map((lieu) => (
                                <LieuCard key={lieu.id} lieu={lieu} />
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </section>
    );
}