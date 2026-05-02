import { createHash, randomBytes } from "crypto";

/**
 * Génère un token aléatoire URL-safe de 32 octets (= 64 chars hex).
 * Utilisé pour les liens d'invitation envoyés par email.
 */
export function generateInvitationToken(): string {
    return randomBytes(32).toString("hex");
}

/**
 * Hash SHA256 d'un token. C'est ce qu'on stocke en DB, jamais le clair.
 */
export function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}