"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
    photos: string[];
    productName: string;
};

export function ProductGallery({ photos, productName }: Props) {
    const [activeIndex, setActiveIndex] = useState(0);

    if (photos.length === 0) {
        return (
            <div className="aspect-square bg-secondary/30 border border-border flex items-center justify-center">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Pas d'image disponible
                </span>
            </div>
        );
    }

    const activePhoto = photos[activeIndex];

    return (
        <div className="space-y-3">
            {/* Photo principale */}
            <div className="relative aspect-square bg-secondary/30 border border-border overflow-hidden">
                <Image
                    src={activePhoto}
                    alt={productName}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority
                />
            </div>

            {/* Thumbnails (si plusieurs photos) */}
            {photos.length > 1 && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {photos.map((url, idx) => (
                        <button
                            key={url}
                            type="button"
                            onClick={() => setActiveIndex(idx)}
                            className={`relative aspect-square overflow-hidden border transition-all ${
                                idx === activeIndex
                                    ? "border-accent border-2"
                                    : "border-border hover:border-accent/50"
                            }`}
                            aria-label={`Voir photo ${idx + 1}`}
                            aria-pressed={idx === activeIndex}
                        >
                            <Image
                                src={url}
                                alt=""
                                fill
                                sizes="(max-width: 640px) 25vw, 10vw"
                                className="object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}