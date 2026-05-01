"use client";

import dynamic from "next/dynamic";
import type { Lieu } from "@/lib/schemas/lieu";

const CarteWallonieInner = dynamic(
    () => import("./carte-wallonie-inner").then((m) => m.CarteWallonie),
    {
        ssr: false,
        loading: () => (
            <section className="bg-primary text-primary-foreground py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                    <div className="aspect-[16/10] w-full bg-background/5 border border-background/10 flex items-center justify-center">
                        <p className="text-background/40 text-sm">Chargement de la carte…</p>
                    </div>
                </div>
            </section>
        ),
    }
);

export function CarteWallonie({ lieux }: { lieux: Lieu[] }) {
    return <CarteWallonieInner lieux={lieux} />;
}