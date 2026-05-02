"use client";

import dynamic from "next/dynamic";

const MiniMap = dynamic(
    () => import("./mini-map").then((m) => ({ default: m.MiniMap })),
    {
        ssr: false,
        loading: () => (
            <div className="aspect-[16/9] w-full bg-secondary border border-border flex items-center justify-center text-xs text-muted-foreground uppercase tracking-wide">
                Chargement de la carte…
            </div>
        ),
    }
);

export function MiniMapClient({
                                  lat,
                                  lng,
                                  label,
                              }: {
    lat: number;
    lng: number;
    label: string;
}) {
    return <MiniMap lat={lat} lng={lng} label={label} />;
}