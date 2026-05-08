"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    addListingPhoto,
    removeListingPhoto,
} from "@/app/actions/marketplace/listings";

// =============================================================================
// MarketplacePhotoUpload
// =============================================================================
// Affiche les photos existantes + permet d'ajouter / supprimer.
// Max 6 photos par listing (verrouillé côté DB).
// =============================================================================

type Photo = {
    id: string;
    storage_path: string;
    position: number;
};

const MAX_PHOTOS = 6;
const ACCEPTED_MIME = "image/jpeg,image/png,image/webp";

function buildPublicUrl(storagePath: string): string {
    const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
    if (!base) return "";
    return `${base}/${storagePath}`;
}

export function MarketplacePhotoUpload({
                                           listingId,
                                           initialPhotos,
                                           disabled = false,
                                       }: {
    listingId: string;
    initialPhotos: Photo[];
    disabled?: boolean;
}) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [photos, setPhotos] = useState<Photo[]>(
        [...initialPhotos].sort((a, b) => a.position - b.position)
    );
    const [error, setError] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [, startTransition] = useTransition();

    async function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;
        if (disabled) return;
        setError(null);

        const remaining = MAX_PHOTOS - photos.length;
        if (remaining <= 0) {
            setError(`Maximum ${MAX_PHOTOS} photos`);
            return;
        }

        const toUpload = Array.from(files).slice(0, remaining);
        if (files.length > remaining) {
            setError(`Seulement ${remaining} photo(s) ajoutée(s) (limite atteinte)`);
        }

        setIsUploading(true);
        for (const file of toUpload) {
            const formData = new FormData();
            formData.append("listingId", listingId);
            formData.append("file", file);

            const result = await addListingPhoto(formData);
            if (!result.ok) {
                setError(result.error.message);
                break;
            }

            setPhotos((prev) => [
                ...prev,
                {
                    id: result.data.id,
                    storage_path: result.data.storage_path,
                    position: result.data.position,
                },
            ]);
        }
        setIsUploading(false);

        if (fileInputRef.current) fileInputRef.current.value = "";
        startTransition(() => router.refresh());
    }

    async function handleRemove(photoId: string) {
        if (disabled) return;
        if (!confirm("Supprimer cette photo ?")) return;

        const result = await removeListingPhoto(photoId);
        if (!result.ok) {
            setError(result.error.message);
            return;
        }

        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        startTransition(() => router.refresh());
    }

    const canAddMore = photos.length < MAX_PHOTOS && !disabled;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {photos.map((photo, idx) => {
                    const url = buildPublicUrl(photo.storage_path);
                    return (
                        <div
                            key={photo.id}
                            className="group relative aspect-square overflow-hidden border border-border bg-secondary/40"
                        >
                            {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={url}
                                    alt={`Photo ${idx + 1}`}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                        Photo
                                    </span>
                                </div>
                            )}
                            {idx === 0 && (
                                <span className="absolute left-2 top-2 bg-accent text-accent-foreground px-1.5 py-0.5 text-[10px] uppercase tracking-[0.2em] font-medium">
                                    Principale
                                </span>
                            )}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={() => handleRemove(photo.id)}
                                    aria-label="Supprimer la photo"
                                    className="absolute right-2 top-2 bg-foreground/80 hover:bg-foreground text-background w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    );
                })}

                {canAddMore && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex aspect-square flex-col items-center justify-center gap-2 border border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                    >
                        {isUploading ? (
                            <span className="text-[10px] uppercase tracking-[0.2em]">
                                Envoi…
                            </span>
                        ) : (
                            <>
                                <span className="text-2xl leading-none font-light">+</span>
                                <span className="text-[10px] uppercase tracking-[0.2em]">
                                    Ajouter
                                </span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_MIME}
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
            />

            <p className="text-xs text-muted-foreground">
                <span className="text-foreground">
                    {photos.length}/{MAX_PHOTOS}
                </span>{" "}
                photos · JPEG, PNG ou WebP · 10 Mo max par photo
                {photos.length === 0 && (
                    <span className="ml-2 text-accent">
                        · au moins une photo requise pour publier
                    </span>
                )}
            </p>

            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}
        </div>
    );
}