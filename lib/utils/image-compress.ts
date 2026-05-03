/**
 * Compresse et redimensionne une image côté client via Canvas.
 * Retourne un nouveau File en JPEG.
 */
export async function compressImage(
    file: File,
    opts: { maxWidth: number; quality: number }
): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ratio = Math.min(opts.maxWidth / img.width, 1);
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Canvas non supporté"));
                return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Compression échouée"));
                        return;
                    }
                    resolve(
                        new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
                            type: "image/jpeg",
                            lastModified: Date.now(),
                        })
                    );
                },
                "image/jpeg",
                opts.quality
            );
        };
        img.onerror = () => reject(new Error("Image illisible"));
        img.src = URL.createObjectURL(file);
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