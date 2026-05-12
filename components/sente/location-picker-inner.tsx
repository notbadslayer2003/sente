"use client";

import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix le bug classique Webpack/Next : les markers Leaflet n'affichent pas leurs icônes
// par défaut. On force des URLs CDN.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const COUNTRY_CENTER: Record<"BE" | "FR", [number, number]> = {
    BE: [50.5, 4.6],
    FR: [46.6, 2.5],
};

type Props = {
    country: "BE" | "FR";
    namelat?: string;
    namelng?: string;
    defaultLat?: string;
    defaultLng?: string;
    getAddressForGeocode?: () => string;
};

export function LocationPickerInner({
                                        country,
                                        namelat = "lat",
                                        namelng = "lng",
                                        defaultLat,
                                        defaultLng,
                                        getAddressForGeocode,
                                    }: Props) {
    const initialLat = defaultLat ? parseFloat(defaultLat) : NaN;
    const initialLng = defaultLng ? parseFloat(defaultLng) : NaN;
    const hasInitial = !isNaN(initialLat) && !isNaN(initialLng);

    const [position, setPosition] = useState<[number, number] | null>(
        hasInitial ? [initialLat, initialLng] : null
    );
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState<string | null>(null);

    const center = position ?? COUNTRY_CENTER[country];
    const zoom = position ? 15 : 7;

    const handleGeocode = async () => {
        if (!getAddressForGeocode) return;
        const query = getAddressForGeocode();
        if (!query.trim()) {
            setGeocodeError("Renseigne d'abord une adresse.");
            return;
        }
        setGeocoding(true);
        setGeocodeError(null);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`
            );
            const data = await res.json();
            if (!data.length) {
                setGeocodeError("Adresse introuvable. Pose le pin manuellement.");
                return;
            }
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            setPosition([lat, lng]);
        } catch {
            setGeocodeError("Erreur réseau.");
        } finally {
            setGeocoding(false);
        }
    };

    const onDragEnd = (lat: number, lng: number) => {
        setPosition([lat, lng]);
    };

    return (
        <div className="space-y-3">
            <div className="aspect-[4/3] border border-border overflow-hidden">
                <MapContainer
                    center={center}
                    zoom={zoom}
                    style={{ width: "100%", height: "100%" }}
                    scrollWheelZoom={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    {position && (
                        <DraggableMarker
                            position={position}
                            onDragEnd={onDragEnd}
                        />
                    )}
                    <MapClickHandler onClick={(lat, lng) => setPosition([lat, lng])} />
                    <RecenterOnPosition position={position} />
                </MapContainer>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {getAddressForGeocode && (
                    <button
                        type="button"
                        onClick={handleGeocode}
                        disabled={geocoding}
                        className="px-4 py-2 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-50"
                    >
                        {geocoding ? "Recherche..." : "Localiser depuis l'adresse"}
                    </button>
                )}
                {position && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {position[0].toFixed(6)}, {position[1].toFixed(6)}
                    </span>
                )}
            </div>

            {!position && (
                <p className="text-xs text-muted-foreground">
                    Clique sur la carte pour poser un pin, ou utilise le bouton ci-dessus pour
                    pré-positionner depuis l&apos;adresse. Tu peux ensuite glisser-déposer le pin.
                </p>
            )}

            {geocodeError && (
                <p className="text-xs text-destructive">{geocodeError}</p>
            )}

            {/* Hidden inputs envoyés dans FormData */}
            <input type="hidden" name={namelat} value={position?.[0] ?? ""} />
            <input type="hidden" name={namelng} value={position?.[1] ?? ""} />
        </div>
    );
}

function DraggableMarker({
                             position,
                             onDragEnd,
                         }: {
    position: [number, number];
    onDragEnd: (lat: number, lng: number) => void;
}) {
    return (
        <Marker
            position={position}
            draggable
            eventHandlers={{
                dragend: (e) => {
                    const m = e.target as L.Marker;
                    const { lat, lng } = m.getLatLng();
                    onDragEnd(lat, lng);
                },
            }}
        />
    );
}

function MapClickHandler({
                             onClick,
                         }: {
    onClick: (lat: number, lng: number) => void;
}) {
    const map = useMap();
    useEffect(() => {
        const handler = (e: L.LeafletMouseEvent) => {
            onClick(e.latlng.lat, e.latlng.lng);
        };
        map.on("click", handler);
        return () => {
            map.off("click", handler);
        };
    }, [map, onClick]);
    return null;
}

function RecenterOnPosition({ position }: { position: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (position) {
            map.flyTo(position, 15, { duration: 0.8 });
        }
    }, [position, map]);
    return null;
}