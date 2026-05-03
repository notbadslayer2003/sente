export type ValidationResult =
    | { ok: true; mimeType: string; extension: "jpg" | "png" | "webp" }
    | { ok: false; error: string };

/**
 * Vérifie qu'un buffer est bien une image JPEG, PNG ou WebP en regardant
 * les premiers octets (magic bytes), pas le MIME annoncé par le client.
 */
export function validateImageMagicBytes(buffer: Buffer): ValidationResult {
    if (buffer.length < 12) {
        return { ok: false, error: "Fichier trop petit ou corrompu" };
    }

    // JPEG : FF D8 FF
    if (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return { ok: true, mimeType: "image/jpeg", extension: "jpg" };
    }

    // PNG : 89 50 4E 47 0D 0A 1A 0A
    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
    ) {
        return { ok: true, mimeType: "image/png", extension: "png" };
    }

    // WebP : "RIFF...WEBP"
    if (
        buffer[0] === 0x52 && // R
        buffer[1] === 0x49 && // I
        buffer[2] === 0x46 && // F
        buffer[3] === 0x46 && // F
        buffer[8] === 0x57 && // W
        buffer[9] === 0x45 && // E
        buffer[10] === 0x42 && // B
        buffer[11] === 0x50 // P
    ) {
        return { ok: true, mimeType: "image/webp", extension: "webp" };
    }

    return {
        ok: false,
        error: "Format d'image non supporté (utilise JPEG, PNG ou WebP)",
    };
}