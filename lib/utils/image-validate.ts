/**
 * Valide qu'un fichier est bien une image en lisant ses magic bytes.
 * Bloque les fichiers maquillés en .jpg avec un autre contenu.
 *
 * Retourne le mime détecté ou null si non reconnu.
 */
export function detectImageMime(buffer: ArrayBuffer): string | null {
    const bytes = new Uint8Array(buffer.slice(0, 12));

    // JPEG : FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return "image/jpeg";
    }

    // PNG : 89 50 4E 47 0D 0A 1A 0A
    if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
    ) {
        return "image/png";
    }

    // WebP : 52 49 46 46 .. .. .. .. 57 45 42 50 ("RIFF...WEBP")
    if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return "image/webp";
    }

    return null;
}

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedImageMime(mime: string | null): boolean {
    return mime !== null && ALLOWED.has(mime);
}