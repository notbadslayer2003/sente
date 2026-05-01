"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import Link from "next/link";
import type { Lieu } from "@/lib/schemas/lieu";

type FilterValue = "tous" | "BE" | "FR";

const VIEWS: Record<"tous" | "BE" | "FR", { center: [number, number]; zoom: number }> = {
    tous: { center: [49.0, 3.5], zoom: 6 },
    BE: { center: [50.4, 4.85], zoom: 8 },
    FR: { center: [46.6, 2.5], zoom: 6 },
};

export function CarteWallonie({ lieux }: { lieux: Lieu[] }) {
    const [filter, setFilter] = useState<FilterValue>("tous");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const visibles =
        filter === "tous" ? lieux : lieux.filter((l) => l.pays === filter);

    const countBE = lieux.filter((l) => l.pays === "BE").length;
    const countFR = lieux.filter((l) => l.pays === "FR").length;
    const view = VIEWS[filter];

    return (
        <section className="bg-primary text-primary-foreground py-24 sm:py-32 overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 sm:mb-16">
                    <div className="space-y-3 max-w-xl">
                        <p className="text-xs uppercase tracking-[0.25em] text-background/60">
                            Sente en carte
                        </p>
                        <h2 className="font-display-soft text-background text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                            Le territoire,{" "}
                            <span className="italic font-light">vu d&apos;en haut.</span>
                        </h2>
                        <p className="text-background/70 text-base leading-relaxed pt-2 max-w-xl">
                            Chaque point est un étang vérifié. Cliquez pour explorer.
                        </p>
                    </div>

                    <div className="flex items-center gap-1 bg-background/10 border border-background/15 p-1">
                        <FilterButton
                            active={filter === "tous"}
                            onClick={() => setFilter("tous")}
                        >
                            Tous ({lieux.length})
                        </FilterButton>
                        <FilterButton
                            active={filter === "BE"}
                            onClick={() => setFilter("BE")}
                        >
                            Wallonie ({countBE})
                        </FilterButton>
                        {countFR > 0 && (
                            <FilterButton
                                active={filter === "FR"}
                                onClick={() => setFilter("FR")}
                            >
                                France ({countFR})
                            </FilterButton>
                        )}
                    </div>
                </div>

                <div
                    className="relative aspect-[16/10] w-full overflow-hidden border border-background/10 bg-background/5">
                    {mounted ? (
                        <MapContainer
                            key={filter}
                            center={view.center}
                            zoom={view.zoom}
                            scrollWheelZoom={false}
                            style={{height: "100%", width: "100%", background: "#1c1917"}}
                            attributionControl={false}
                        >
                            <TileLayer
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                                subdomains="abcd"
                                maxZoom={19}
                            />
                            {visibles.map((lieu) => (
                                <CircleMarker
                                    key={lieu.id}
                                    center={[lieu.coordonnees.lat, lieu.coordonnees.lng]}
                                    radius={8}
                                    pathOptions={{
                                        color: "#C8956D",
                                        weight: 2,
                                        fillColor: "#C8956D",
                                        fillOpacity: 0.85,
                                    }}
                                >
                                    <Tooltip
                                        direction="top"
                                        offset={[0, -8]}
                                        opacity={1}
                                        className="!bg-background !text-foreground !border-0 !shadow-md !font-body !text-xs"
                                    >
                                        <div className="space-y-0.5 py-0.5">
                                            <p className="font-display text-sm leading-tight">
                                                {lieu.nom}
                                            </p>
                                            <p className="text-muted-foreground text-[10px] uppercase tracking-wider">
                                                {lieu.commune}
                                            </p>
                                        </div>
                                    </Tooltip>
                                </CircleMarker>
                            ))}
                        </MapContainer>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-background/40 text-sm">
                            Chargement de la carte…
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 mt-6 text-xs text-background/60">
                    <div className="flex items-center gap-6">
                        <LegendDot color="#C8956D" label="Étang vérifié" />
                    </div>
                    <Link
                        href="/lieux"
                        className="uppercase tracking-wide border-b border-background/40 pb-0.5 hover:text-accent hover:border-accent transition-colors"
                    >
                        Voir la carte complète →
                    </Link>
                </div>
            </div>
        </section>
    );
}

function FilterButton({
                          active,
                          onClick,
                          children,
                      }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 text-xs uppercase tracking-wide transition-colors ${
                active
                    ? "bg-accent text-accent-foreground"
                    : "text-background/70 hover:text-background"
            }`}
        >
            {children}
        </button>
    );
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
      <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color }}
      />
            <span className="uppercase tracking-wider">{label}</span>
        </div>
    );
}