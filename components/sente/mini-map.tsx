"use client";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { Icon } from "leaflet";
import "leaflet/dist/leaflet.css";

const customIcon = new Icon({
    iconUrl:
        "data:image/svg+xml;base64," +
        Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><path fill="#4a6741" d="M16 0C7.16 0 0 7.16 0 16c0 11.05 16 28 16 28s16-16.95 16-28C32 7.16 24.84 0 16 0z"/><circle cx="16" cy="16" r="6" fill="#fff"/></svg>`
        ).toString("base64"),
    iconSize: [32, 44],
    iconAnchor: [16, 44],
});

export function MiniMap({
                            lat,
                            lng,
                            label,
                        }: {
    lat: number;
    lng: number;
    label: string;
}) {
    return (
        <div className="aspect-[16/9] w-full bg-secondary border border-border overflow-hidden">
            <MapContainer
                center={[lat, lng]}
                zoom={13}
                style={{ width: "100%", height: "100%" }}
                scrollWheelZoom={false}
                attributionControl={false}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    subdomains="abcd"
                />
                <Marker position={[lat, lng]} icon={customIcon} title={label} />
            </MapContainer>
        </div>
    );
}