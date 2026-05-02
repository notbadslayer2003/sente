/**
 * Compresse une image côté client avant upload.
 * Resize à maxWidth/maxHeight, output JPEG qualité 0.85.
 * Aucune dépendance, utilise Canvas API natif.
 */
export async function compressImage(
    file: File,
    options: {
        maxWidth: number;
        maxHeight: number;
        quality?: number;
    }
): Promise<Blob> {
    const { maxWidth, maxHeight, quality = 0.85 } = options;

    const dataUrl = await readAsDataUrl(file);
    const img = await loadImage(dataUrl);

    let { width, height } = img;
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non supporté");

    ctx.drawImage(img, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Échec compression"));
            },
            "image/jpeg",
            quality
        );
    });
}

function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Image invalide"));
        img.src = src;
    });
}