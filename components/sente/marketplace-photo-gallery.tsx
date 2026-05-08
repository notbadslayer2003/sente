"use client";

import { useEffect, useState } from "react";

// =============================================================================
// MarketplacePhotoGallery — galerie photos avec miniatures + lightbox
// =============================================================================

export function MarketplacePhotoGallery({
                                            photos,
                                            alt,
                                        }: {
    photos: { id: string; url: string }[];
    alt: string;
}) {
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    useEffect(() => {
        if (!lightboxOpen) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") setLightboxOpen(false);
            if (e.key === "ArrowLeft")
                setSelectedIdx((i) => (i - 1 + photos.length) % photos.length);
            if (e.key === "ArrowRight")
                setSelectedIdx((i) => (i + 1) % photos.length);
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [lightboxOpen, photos.length]);

    if (photos.length === 0) {
        return (
            <div className="aspect-square border border-border bg-secondary/40 flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Aucune photo
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block aspect-square w-full overflow-hidden border border-border bg-secondary/40"
                aria-label="Agrandir la photo"
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={photos[selectedIdx].url}
                    alt={alt}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                />
            </button>

            {photos.length > 1 && (
                <div className="grid grid-cols-6 gap-2">
                    {photos.map((p, idx) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedIdx(idx)}
                            className={`aspect-square overflow-hidden border-2 transition-colors ${
                                idx === selectedIdx
                                    ? "border-accent"
                                    : "border-transparent hover:border-border"
                            }`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={p.url}
                                alt={`${alt} — photo ${idx + 1}`}
                                className="h-full w-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightboxOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
                    onClick={() => setLightboxOpen(false)}
                    role="dialog"
                    aria-modal="true"
                >
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxOpen(false);
                        }}
                        className="absolute right-4 top-4 bg-white/10 hover:bg-white/20 transition-colors text-white w-10 h-10 flex items-center justify-center text-lg"
                        aria-label="Fermer"
                    >
                        ✕
                    </button>
                    {photos.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIdx(
                                        (i) => (i - 1 + photos.length) % photos.length
                                    );
                                }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 transition-colors text-white w-12 h-12 flex items-center justify-center text-2xl"
                                aria-label="Photo précédente"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIdx((i) => (i + 1) % photos.length);
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 transition-colors text-white w-12 h-12 flex items-center justify-center text-2xl"
                                aria-label="Photo suivante"
                            >
                                ›
                            </button>
                            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] text-white/70">
                                {selectedIdx + 1} / {photos.length}
                            </span>
                        </>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={photos[selectedIdx].url}
                        alt={alt}
                        className="max-h-full max-w-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}