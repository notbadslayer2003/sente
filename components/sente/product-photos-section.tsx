"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition, useRef } from "react";
import { Lock } from "lucide-react";
import {
    uploadProductPhotoAction,
    removeProductPhotoAction,
    reorderProductPhotosAction,
    setPrimaryProductPhotoAction,
} from "@/app/actions/product-photos";
import { compressImage } from "@/lib/utils/image-compress";
import type { ProductDetail } from "@/lib/dal/products";

const MAX_PHOTOS_HARD = 8; // limite globale (en plus du plan)
const MAX_FILE_SIZE_MB = 10;

type Props = {
    product: ProductDetail;
    onMutated: () => void;
    canAddPhoto: boolean;
    addPhotoReason: string | null;
    slug: string;
};

export function ProductPhotosSection({
                                         product,
                                         onMutated,
                                         canAddPhoto,
                                         addPhotoReason,
                                         slug,
                                     }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{
        current: number;
        total: number;
    } | null>(null);

    // État local pour le drag & drop optimiste
    const [photos, setPhotos] = useState<string[]>(product.photos);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Sync si le parent change
    if (
        photos.length !== product.photos.length ||
        photos.some((p, i) => p !== product.photos[i])
    ) {
        if (!uploading) {
            setPhotos(product.photos);
        }
    }

    const onFilesPicked = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setError(null);

        // Garde-fou plan : si la feature est bloquée par le gate, on refuse
        // tout upload même via drag&drop ou sélection multiple.
        if (!canAddPhoto) {
            setError(addPhotoReason ?? "Limite de photos atteinte sur ton plan.");
            return;
        }

        const remainingSlots = MAX_PHOTOS_HARD - photos.length;
        if (remainingSlots <= 0) {
            setError(`Limite de ${MAX_PHOTOS_HARD} photos atteinte.`);
            return;
        }

        const filesArray = Array.from(files);
        if (filesArray.length > remainingSlots) {
            setError(
                `Tu as choisi ${filesArray.length} photos mais seules ${remainingSlots} place(s) restent. Les premières seront uploadées.`
            );
        }

        const toUpload = filesArray.slice(0, remainingSlots);
        setUploading(true);
        setUploadProgress({ current: 0, total: toUpload.length });

        try {
            for (let i = 0; i < toUpload.length; i++) {
                const file = toUpload[i];

                if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                    setError(
                        `"${file.name}" est trop volumineux (max ${MAX_FILE_SIZE_MB} Mo).`
                    );
                    break;
                }

                if (
                    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
                ) {
                    setError(
                        `"${file.name}" : format non supporté (JPEG, PNG ou WebP uniquement).`
                    );
                    break;
                }

                let compressed: File;
                try {
                    compressed = await compressImage(file, {
                        maxWidth: 2000,
                        quality: 0.85,
                    });
                } catch (err) {
                    console.error("compressImage failed:", err);
                    setError(`Échec de compression de "${file.name}".`);
                    break;
                }

                const fd = new FormData();
                fd.set("product_id", product.id);
                fd.set("file", compressed);

                const result = await uploadProductPhotoAction(fd);
                if (!result.ok) {
                    setError(`Erreur sur "${file.name}" : ${result.error}`);
                    break;
                }
                if (result.data) {
                    setPhotos((prev) => [...prev, result.data!.url]);
                }

                setUploadProgress({ current: i + 1, total: toUpload.length });
            }
        } finally {
            setUploading(false);
            setUploadProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            onMutated();
        }
    };

    const onRemove = (url: string) => {
        if (!confirm("Supprimer cette photo ?")) return;

        const previousPhotos = photos;
        setPhotos((prev) => prev.filter((p) => p !== url));

        const fd = new FormData();
        fd.set("product_id", product.id);
        fd.set("photo_url", url);

        startTransition(async () => {
            setError(null);
            const r = await removeProductPhotoAction(fd);
            if (!r.ok) {
                setPhotos(previousPhotos);
                setError(r.error);
            } else {
                onMutated();
            }
        });
    };

    const onSetPrimary = (url: string) => {
        if (photos[0] === url) return;

        const previousPhotos = photos;
        const newPhotos = [url, ...photos.filter((p) => p !== url)];
        setPhotos(newPhotos);

        const fd = new FormData();
        fd.set("product_id", product.id);
        fd.set("photo_url", url);

        startTransition(async () => {
            setError(null);
            const r = await setPrimaryProductPhotoAction(fd);
            if (!r.ok) {
                setPhotos(previousPhotos);
                setError(r.error);
            } else {
                onMutated();
            }
        });
    };

    const onDragStart = (idx: number) => (e: React.DragEvent) => {
        setDraggedIndex(idx);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(idx));
    };

    const onDragOver = (idx: number) => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const onDrop = (targetIdx: number) => (e: React.DragEvent) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === targetIdx) {
            setDraggedIndex(null);
            return;
        }

        const previousPhotos = photos;
        const reordered = [...photos];
        const [moved] = reordered.splice(draggedIndex, 1);
        reordered.splice(targetIdx, 0, moved);

        setPhotos(reordered);
        setDraggedIndex(null);

        const fd = new FormData();
        fd.set("product_id", product.id);
        fd.set("photo_urls", JSON.stringify(reordered));

        startTransition(async () => {
            setError(null);
            const r = await reorderProductPhotosAction(fd);
            if (!r.ok) {
                setPhotos(previousPhotos);
                setError(r.error);
            } else {
                onMutated();
            }
        });
    };

    const onDragEnd = () => setDraggedIndex(null);

    const remaining = MAX_PHOTOS_HARD - photos.length;

    return (
        <div className="space-y-5">
            {error && (
                <div className="border border-destructive bg-destructive/5 p-3">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}

            {/* Banner de gate plan : seulement si la feature est bloquée */}
            {!canAddPhoto && (
                <div className="border border-accent/30 bg-accent/5 p-4 flex items-start gap-3">
                    <Lock
                        className="w-4 h-4 text-accent shrink-0 mt-0.5"
                        strokeWidth={1.75}
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed">
                            {addPhotoReason ??
                                "Limite de photos atteinte sur ton plan."}
                        </p>
                        <Link
                            href={`/dashboard/${slug}/parametres`}
                            className="mt-2 inline-block text-[11px] uppercase tracking-wide text-accent border-b border-accent hover:opacity-70 transition-opacity"
                        >
                            Voir les plans →
                        </Link>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs text-muted-foreground">
                        {photos.length}/{MAX_PHOTOS_HARD} photo
                        {photos.length > 1 ? "s" : ""}. La première est l&apos;image
                        principale (affichée en card).
                    </p>
                    {photos.length > 1 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                            Glisse-dépose pour réordonner. Clique &quot;Définir comme
                            principale&quot; pour faire passer une photo en tête.
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canAddPhoto || uploading || remaining <= 0}
                    title={!canAddPhoto ? addPhotoReason ?? "" : ""}
                    className="px-4 py-2 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-border"
                >
                    {uploading
                        ? `Upload ${uploadProgress?.current ?? 0}/${uploadProgress?.total ?? 0}...`
                        : !canAddPhoto
                            ? "Limite plan atteinte"
                            : remaining === 0
                                ? "Limite atteinte"
                                : `Ajouter (${remaining} restante${remaining > 1 ? "s" : ""})`}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => onFilesPicked(e.target.files)}
                    className="hidden"
                />
            </div>

            {photos.length === 0 ? (
                <div
                    onDragOver={(e) => {
                        if (!canAddPhoto) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={(e) => {
                        if (!canAddPhoto) return;
                        e.preventDefault();
                        onFilesPicked(e.dataTransfer.files);
                    }}
                    className={`border border-dashed border-border p-12 text-center transition-colors ${
                        canAddPhoto
                            ? "cursor-pointer hover:bg-secondary/20"
                            : "cursor-not-allowed opacity-50"
                    }`}
                    onClick={() => canAddPhoto && fileInputRef.current?.click()}
                >
                    <p className="text-sm text-foreground">
                        Glisse tes photos ici, ou clique pour parcourir.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                        JPEG, PNG ou WebP. Max {MAX_FILE_SIZE_MB} Mo par photo.
                        Compression auto vers 2000px max.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {photos.map((url, idx) => (
                        <PhotoCard
                            key={url}
                            url={url}
                            isPrimary={idx === 0}
                            isDragging={draggedIndex === idx}
                            onRemove={() => onRemove(url)}
                            onSetPrimary={() => onSetPrimary(url)}
                            onDragStart={onDragStart(idx)}
                            onDragOver={onDragOver(idx)}
                            onDrop={onDrop(idx)}
                            onDragEnd={onDragEnd}
                            disabled={isPending || uploading}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PhotoCard({
                       url,
                       isPrimary,
                       isDragging,
                       onRemove,
                       onSetPrimary,
                       onDragStart,
                       onDragOver,
                       onDrop,
                       onDragEnd,
                       disabled,
                   }: {
    url: string;
    isPrimary: boolean;
    isDragging: boolean;
    onRemove: () => void;
    onSetPrimary: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: () => void;
    disabled: boolean;
}) {
    return (
        <div
            draggable={!disabled}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={`relative border bg-secondary/20 transition-opacity ${
                isPrimary ? "border-accent border-2" : "border-border"
            } ${isDragging ? "opacity-30" : "opacity-100"} ${
                disabled ? "cursor-not-allowed" : "cursor-move"
            }`}
        >
            <div className="aspect-square relative overflow-hidden">
                <Image
                    src={url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover pointer-events-none"
                />
                {isPrimary && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-[9px] uppercase tracking-wide bg-accent text-accent-foreground">
                        Principale
                    </span>
                )}
            </div>

            <div className="p-2 flex items-center justify-between gap-2 border-t border-border bg-background">
                {!isPrimary ? (
                    <button
                        type="button"
                        onClick={onSetPrimary}
                        disabled={disabled}
                        className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-accent transition-colors disabled:opacity-50"
                    >
                        Définir principale
                    </button>
                ) : (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        En tête
                    </span>
                )}
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={disabled}
                    className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                    Supprimer
                </button>
            </div>
        </div>
    );
}