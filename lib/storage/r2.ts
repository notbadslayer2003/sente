import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

function getR2Client(): S3Client {
    if (_client) return _client;

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error(
            "R2 credentials missing (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)"
        );
    }

    _client = new S3Client({
        region: "auto", // R2 ignore la region, on met "auto"
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });

    return _client;
}

function getBucketName(): string {
    const name = process.env.R2_BUCKET_NAME;
    if (!name) throw new Error("R2_BUCKET_NAME manquante");
    return name;
}

function getPublicUrl(): string {
    const url = process.env.R2_PUBLIC_URL;
    if (!url) throw new Error("R2_PUBLIC_URL manquante");
    return url.replace(/\/$/, ""); // strip trailing slash
}

/**
 * Upload un fichier vers R2 et retourne son URL publique.
 *
 * @param key - chemin du fichier dans le bucket (ex: "orgs/abc/cover.jpg")
 * @param buffer - contenu du fichier
 * @param contentType - MIME type (ex: "image/jpeg")
 */
export async function uploadToR2(
    key: string,
    buffer: Buffer | Uint8Array,
    contentType: string
): Promise<{ url: string; key: string }> {
    const client = getR2Client();
    const bucket = getBucketName();

    await client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            // Cache long : les noms de fichiers ont un timestamp/uuid donc immutable
            CacheControl: "public, max-age=31536000, immutable",
        })
    );

    const url = `${getPublicUrl()}/${key}`;
    return { url, key };
}

/**
 * Supprime un fichier de R2.
 * Accepte soit une URL R2 publique, soit une key directe.
 */
export async function deleteFromR2(urlOrKey: string): Promise<void> {
    const client = getR2Client();
    const bucket = getBucketName();
    const publicUrl = getPublicUrl();

    // Extrait la key si on reçoit une URL publique
    let key = urlOrKey;
    if (urlOrKey.startsWith(publicUrl)) {
        key = urlOrKey.slice(publicUrl.length + 1); // +1 pour le /
    }

    if (!key) return;

    try {
        await client.send(
            new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
            })
        );
    } catch (err) {
        // On log mais on n'échoue pas : si le fichier n'existe pas ou est déjà supprimé, c'est OK
        console.error(`R2 delete failed for ${key}:`, err);
    }
}

/**
 * Génère une key unique pour un fichier dans R2.
 * Format : {prefix}/{orgId}/{filename-{timestamp}.{ext}}
 */
export function generateR2Key(opts: {
    prefix: "orgs" | "users" | "posts";
    orgOrUserId: string;
    subPath?: string; // ex: "cover", "gallery"
    extension: string; // "jpg" | "png" | "webp"
}): string {
    const ts = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const sub = opts.subPath ? `${opts.subPath}-` : "";
    return `${opts.prefix}/${opts.orgOrUserId}/${sub}${ts}-${random}.${opts.extension}`;
}