"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import Link from "next/link";
import type { Lieu } from "@/lib/schemas/lieu";
import { TypeLieuLabel } from "@/lib/schemas/lieu";

// Centre approximatif Wallonie + zoom qui couvre les 5 provinces
const WALLONIE_CENTER: [number, number] = [50.4, 4.85];
const WALLONIE_ZOOM = 8;

export function CarteWallonie({ lieux }: { lieux: Lieu[] }) {
    const [filter, setFilter] = useState<"tous" | "peche" | "chasse">("tous");
    const [mounted, setMounted] = useState(false);

    // Leaflet ne tourne qu'en navigateur — on attend le mount avant de rendre la carte
    useEffect(() => {
        setMounted(true);
    }, []);

    const visibles =
        filter === "tous" ? lieux : lieux.filter((l) => l.type === filter);

    return (
        <section className="bg-primary text-primary-foreground py-24 sm:py-32 overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12 sm:mb-16">
                    <div className="space-y-3 max-w-xl">
                        <p className="text-xs uppercase tracking-[0.25em] text-background/60">
                            Sente en Wallonie
                        </p>
                        <h2 className="font-display-soft text-background text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                            Le territoire,{" "}
                            <span className="italic font-light">vu d&apos;en haut.</span>
                        </h2>
                        <p className="text-background/70 text-base leading-relaxed pt-2 max-w-xl">
                            Chaque point est un lieu vérifié. Cliquez pour explorer.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-1 bg-background/10 border border-background/15 p-1">
                            <FilterButton
                                active={filter === "tous"}
                                onClick={() => setFilter("tous")}
                            >
                                Tous ({lieux.length})
                            </FilterButton>
                            <FilterButton
                                active={filter === "peche"}
                                onClick={() => setFilter("peche")}
                            >
                                Pêche ({lieux.filter((l) => l.type === "peche").length})
                            </FilterButton>
                            <FilterButton
                                active={filter === "chasse"}
                                onClick={() => setFilter("chasse")}
                            >
                                Chasse ({lieux.filter((l) => l.type === "chasse").length})
                            </FilterButton>
                        </div>
                    </div>
                </div>

                <div
                    className="relative aspect-[16/10] w-full overflow-hidden border border-background/10 bg-background/5">
                    {mounted ? (
                        <MapContainer
                            center={WALLONIE_CENTER}
                            zoom={WALLONIE_ZOOM}
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
                                        color: lieu.type === "peche" ? "#C8956D" : "#7BAE8E",
                                        weight: 2,
                                        fillColor: lieu.type === "peche" ? "#C8956D" : "#7BAE8E",
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
                                                {TypeLieuLabel[lieu.type]} · {lieu.commune}
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
                        <LegendDot color="#C8956D" label="Pêche"/>
                        <LegendDot color="#7BAE8E" label="Chasse"/>
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