"use client";

import dynamic from "next/dynamic";

const LocationPickerInner = dynamic(
    () => import("./location-picker-inner").then((m) => m.LocationPickerInner),
    {
        ssr: false,
        loading: () => (
            <div className="aspect-[4/3] bg-secondary/20 border border-border flex items-center justify-center">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Chargement de la carte...
                </p>
            </div>
        ),
    }
);

export type LocationPickerProps = {
    country: "BE" | "FR";
    namelat?: string;
    namelng?: string;
    defaultLat?: string;
    defaultLng?: string;
    getAddressForGeocode?: () => string;
};

export function LocationPicker(props: LocationPickerProps) {
    return <LocationPickerInner {...props} />;
}