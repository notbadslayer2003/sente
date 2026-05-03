"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import { compressImage } from "@/lib/utils/image-compress";
import {
    uploadOrgCoverAction,
    addOrgGalleryPhotoAction,
    removeOrgGalleryPhotoAction,
} from "@/app/actions/photos";

const COVER_MAX = { maxWidth: 1920, quality: 0.85 };
const GALLERY_MAX = { maxWidth: 1600, quality: 0.85 };
export function CoverUploader({
                                  orgId,
                                  currentUrl,
                              }: {
    orgId: string;
    currentUrl: string | null;
}) {
    const [preview, setPreview] = useState<string | null>(currentUrl);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);

    const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError(null);

        try {
            const compressed = await compressImage(file, COVER_MAX);
            const blobFile = new File([compressed], file.name, {
                type: "image/jpeg",
            });

            const fd = new FormData();
            fd.set("org_id", orgId);
            fd.set("file", blobFile);

            startTransition(async () => {
                const result = await uploadOrgCoverAction(fd);
                if (result.ok && result.data) {
                    setPreview(result.data.url);
                } else if (!result.ok) {
                    setError(result.error);
                }
            });
        } catch (err) {
            setError("Erreur lors de la préparation de l'image");
            console.error(err);
        }

        if (inputRef.current) inputRef.current.value = "";
    };

    return (
        <div className="space-y-4">
            <div className="relative aspect-[16/9] w-full bg-secondary/40 border border-border overflow-hidden">
                {preview ? (
                    <Image
                        src={preview}
                        alt="Photo de couverture"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        unoptimized
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                        Aucune photo de couverture
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={isPending}
                    className="border border-foreground hover:bg-foreground hover:text-background transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending ? "Upload..." : preview ? "Changer la photo" : "Ajouter une photo"}
                </button>
                <p className="text-xs text-muted-foreground">
                    JPEG, PNG ou WebP. Format 16:9 recommandé.
                </p>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onChange}
            />

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
}

export function GalleryUploader({
                                    orgId,
                                    currentPhotos,
                                }: {
    orgId: string;
    currentPhotos: string[];
}) {
    const [photos, setPhotos] = useState<string[]>(currentPhotos);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);

    const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        setError(null);

        if (photos.length + files.length > 15) {
            setError("Limite de 15 photos atteinte");
            return;
        }

        for (const file of files) {
            try {
                const compressed = await compressImage(file, GALLERY_MAX);
                const blobFile = new File([compressed], file.name, {
                    type: "image/jpeg",
                });
                const fd = new FormData();
                fd.set("org_id", orgId);
                fd.set("file", blobFile);

                await new Promise<void>((resolve) => {
                    startTransition(async () => {
                        const result = await addOrgGalleryPhotoAction(fd);
                        if (result.ok && result.data) {
                            setPhotos((p) => [...p, result.data!.url]);
                        } else if (!result.ok) {
                            setError(result.error);
                        }
                        resolve();
                    });
                });
            } catch (err) {
                setError("Erreur lors de la préparation");
                console.error(err);
            }
        }

        if (inputRef.current) inputRef.current.value = "";
    };

    const onRemove = (url: string) => {
        startTransition(async () => {
            const fd = new FormData();
            fd.set("org_id", orgId);
            fd.set("photo_url", url);
            const result = await removeOrgGalleryPhotoAction(fd);
            if (result.ok) {
                setPhotos((p) => p.filter((u) => u !== url));
            } else {
                setError(result.error);
            }
        });
    };

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map((url) => (
                    <div
                        key={url}
                        className="relative aspect-square bg-secondary/40 border border-border overflow-hidden group"
                    >
                        <Image
                            src={url}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 25vw"
                            unoptimized
                        />
                        <button
                            type="button"
                            onClick={() => onRemove(url)}
                            disabled={isPending}
                            className="absolute top-2 right-2 bg-background/90 text-foreground hover:bg-destructive hover:text-background text-xs px-2 py-1 uppercase tracking-wide transition-colors opacity-0 group-hover:opacity-100"
                        >
                            Supprimer
                        </button>
                    </div>
                ))}

                {photos.length < 15 && (
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={isPending}
                        className="aspect-square bg-secondary/40 border border-dashed border-border hover:border-accent hover:bg-accent/5 transition-colors flex items-center justify-center text-xs uppercase tracking-wide text-muted-foreground hover:text-accent disabled:opacity-50"
                    >
                        {isPending ? "Upload..." : "+ Ajouter"}
                    </button>
                )}
            </div>

            <p className="text-xs text-muted-foreground">
                {photos.length} / 15 photos. JPEG, PNG ou WebP.
            </p>

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={onChange}
            />

            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}