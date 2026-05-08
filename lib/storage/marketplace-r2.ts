import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { uploadToR2, deleteFromR2 } from "@/lib/storage/r2";

// =============================================================================
// Constantes
// =============================================================================

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PDF_BYTES = 5 * 1024 * 1024;    // 5 MB

const ALLOWED_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
const ALLOWED_PDF_MIME = ["application/pdf"] as const;

const SIGNED_URL_TTL_SECONDS = 5 * 60; // 5 min par défaut

type AllowedPhotoMime = (typeof ALLOWED_PHOTO_MIME)[number];

// =============================================================================
// Client R2 privé (séparé du client public dans lib/storage/r2.ts)
// =============================================================================

let _privateClient: S3Client | null = null;

function getR2PrivateClient(): S3Client {
    if (_privateClient) return _privateClient;

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_PRIVATE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_PRIVATE_SECRET_ACCESS_KEY;  // ← renommé

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error(
            "R2 private credentials missing (R2_ACCOUNT_ID, R2_PRIVATE_ACCESS_KEY_ID, R2_PRIVATE_SECRET_ACCESS_KEY)"
        );
    }

    _privateClient = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    });

    return _privateClient;
}

function getPrivateBucketName(): string {
    const name = process.env.R2_PRIVATE_BUCKET_NAME;
    if (!name) throw new Error("R2_PRIVATE_BUCKET_NAME manquante");
    return name;
}

// =============================================================================
// Validation entrée
// =============================================================================

function validatePhoto(buffer: Buffer | Uint8Array, contentType: string): AllowedPhotoMime {
    if (buffer.byteLength > MAX_PHOTO_BYTES) {
        throw new Error(`Photo trop lourde : ${buffer.byteLength} bytes (max ${MAX_PHOTO_BYTES})`);
    }
    if (!ALLOWED_PHOTO_MIME.includes(contentType as AllowedPhotoMime)) {
        throw new Error(
            `MIME non autorisé : ${contentType} (autorisés : ${ALLOWED_PHOTO_MIME.join(", ")})`
        );
    }
    return contentType as AllowedPhotoMime;
}

function validatePdf(buffer: Buffer | Uint8Array, contentType: string): void {
    if (buffer.byteLength > MAX_PDF_BYTES) {
        throw new Error(`PDF trop lourd : ${buffer.byteLength} bytes (max ${MAX_PDF_BYTES})`);
    }
    if (!ALLOWED_PDF_MIME.includes(contentType as (typeof ALLOWED_PDF_MIME)[number])) {
        throw new Error(`MIME non autorisé : ${contentType} (attendu : application/pdf)`);
    }
}

function extensionFromMime(mime: AllowedPhotoMime): "jpg" | "png" | "webp" {
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/png") return "png";
    return "webp";
}

function randomSuffix(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// =============================================================================
// Listings — bucket public, URL directe
// =============================================================================

/**
 * Upload une photo de listing dans le bucket public.
 * Path : listings/{listing_id}/{position}-{ts}-{random}.{ext}
 *
 * @param listingId UUID du listing
 * @param position 0..5 (0 = couverture)
 * @param buffer contenu binaire (max 10 MB)
 * @param contentType image/jpeg | image/png | image/webp
 * @returns { url, key, storage_path } — storage_path = ce qu'on stocke en DB
 */
export async function uploadListingPhoto(
    listingId: string,
    position: number,
    buffer: Buffer | Uint8Array,
    contentType: string
): Promise<{ url: string; key: string; storage_path: string }> {
    const mime = validatePhoto(buffer, contentType);
    if (position < 0 || position > 5) {
        throw new Error(`Position invalide : ${position} (attendu 0..5)`);
    }

    const ext = extensionFromMime(mime);
    const storage_path = `listings/${listingId}/${position}-${randomSuffix()}.${ext}`;

    const { url, key } = await uploadToR2(storage_path, buffer, contentType);
    return { url, key, storage_path };
}

/**
 * Supprime une photo de listing du bucket public.
 * Accepte soit la key brute (= storage_path), soit l'URL R2 publique.
 */
export async function deleteListingPhoto(urlOrKey: string): Promise<void> {
    return deleteFromR2(urlOrKey);
}

// =============================================================================
// Disputes — bucket privé, signed URL pour visualiser
// =============================================================================

/**
 * Upload une preuve de litige (photo) dans le bucket privé.
 * Path : disputes/{dispute_id}/{ts}-{random}.{ext}
 *
 * Retourne uniquement la key (pas d'URL publique). Pour afficher l'image,
 * appeler getSignedUrlForPrivateKey(key) côté Server Action.
 */
export async function uploadDisputeEvidence(
    disputeId: string,
    buffer: Buffer | Uint8Array,
    contentType: string
): Promise<{ key: string }> {
    const mime = validatePhoto(buffer, contentType);
    const ext = extensionFromMime(mime);
    const key = `disputes/${disputeId}/${randomSuffix()}.${ext}`;

    const client = getR2PrivateClient();
    await client.send(
        new PutObjectCommand({
            Bucket: getPrivateBucketName(),
            Key: key,
            Body: buffer,
            ContentType: contentType,
            CacheControl: "private, max-age=3600",
        })
    );

    return { key };
}

// =============================================================================
// Shipping labels — bucket privé, signed URL pour vendeur
// =============================================================================

/**
 * Upload un label d'expédition (PDF) dans le bucket privé.
 * Path fixe : shipping-labels/{order_id}.pdf (1 label par order, écrasable)
 */
export async function uploadShippingLabel(
    orderId: string,
    buffer: Buffer | Uint8Array
): Promise<{ key: string }> {
    validatePdf(buffer, "application/pdf");

    const key = `shipping-labels/${orderId}.pdf`;
    const client = getR2PrivateClient();

    await client.send(
        new PutObjectCommand({
            Bucket: getPrivateBucketName(),
            Key: key,
            Body: buffer,
            ContentType: "application/pdf",
            CacheControl: "private, max-age=3600",
        })
    );

    return { key };
}

// =============================================================================
// Signed URLs — accès temporaire au bucket privé
// =============================================================================

/**
 * Génère une URL signée temporaire pour lire un objet du bucket privé.
 * À utiliser pour afficher une preuve de litige ou télécharger un label.
 *
 * @param key chemin dans le bucket privé (ex: "disputes/abc/xxx.webp")
 * @param expiresInSeconds durée de validité (default 5 min)
 * @returns URL signée valable pendant expiresInSeconds
 */
export async function getSignedUrlForPrivateKey(
    key: string,
    expiresInSeconds: number = SIGNED_URL_TTL_SECONDS
): Promise<string> {
    if (expiresInSeconds < 30 || expiresInSeconds > 7 * 24 * 60 * 60) {
        throw new Error(`TTL signed URL hors plage : ${expiresInSeconds}s (30s..7j)`);
    }

    const client = getR2PrivateClient();
    const command = new GetObjectCommand({
        Bucket: getPrivateBucketName(),
        Key: key,
    });

    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Supprime un objet du bucket privé.
 */
export async function deleteFromPrivateBucket(key: string): Promise<void> {
    if (!key) return;
    const client = getR2PrivateClient();
    try {
        await client.send(
            new DeleteObjectCommand({
                Bucket: getPrivateBucketName(),
                Key: key,
            })
        );
    } catch (err) {
        // Idempotent : si déjà absent, on n'échoue pas
        console.error(`R2 private delete failed for ${key}:`, err);
    }
}

/**
 * Construit l'URL publique d'une ressource du bucket public R2 (sente-media)
 * depuis son storage_path. Utilisable uniquement côté serveur (variable
 * R2_PUBLIC_URL n'est pas exposée au client).
 *
 * Exemple : storage_path "marketplace/listings/abc/0.jpg"
 *           → https://cdn.lasente.eu/marketplace/listings/abc/0.jpg
 */
export function getMarketplacePublicUrl(storagePath: string): string {
    const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    if (!base) {
        throw new Error("R2_PUBLIC_URL non définie");
    }
    return `${base}/${storagePath}`;
}
