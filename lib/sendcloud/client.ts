import { z } from "zod";

// =============================================================================
// Sendcloud — client REST V2
// =============================================================================
// Auth : Basic Auth (public_key:secret_key)
// Base URL : https://panel.sendcloud.sc/api/v2
//
// Pas d'environnement sandbox séparé. Pour tester sans facturation, utiliser
// le shipping_method "Unstamped Letter" (sendcloud:letter), gratuit.
// =============================================================================

export class SendcloudError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number | null,
        public readonly errorCode: string | null,
        public readonly raw: unknown
    ) {
        super(message);
        this.name = "SendcloudError";
    }
}

function getCredentials() {
    const publicKey = process.env.SENDCLOUD_PUBLIC_KEY;
    const secretKey = process.env.SENDCLOUD_SECRET_KEY;
    const baseUrl = process.env.SENDCLOUD_API_URL ?? "https://panel.sendcloud.sc/api/v2";

    if (!publicKey || !secretKey) {
        throw new Error(
            "Sendcloud credentials missing (SENDCLOUD_PUBLIC_KEY, SENDCLOUD_SECRET_KEY)"
        );
    }
    return { publicKey, secretKey, baseUrl };
}

function getAuthHeader(publicKey: string, secretKey: string): string {
    const token = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
    return `Basic ${token}`;
}

/**
 * Wrapper générique pour les appels Sendcloud.
 * Valide la response avec zod et lève une SendcloudError typée si erreur.
 */
export async function sendcloudRequest<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    options: {
        query?: Record<string, string | number | boolean | undefined | null>;
        body?: unknown;
        responseSchema: z.ZodType<T>;
        baseUrl?: string; // ← override pour les sous-domaines (service-points)
    }
): Promise<T> {
    const { publicKey, secretKey, baseUrl: defaultBaseUrl } = getCredentials();
    const baseUrl = options.baseUrl ?? defaultBaseUrl;

    const url = new URL(`${baseUrl}${path}`);
    if (options.query) {
        for (const [k, v] of Object.entries(options.query)) {
            if (v !== undefined && v !== null) {
                url.searchParams.set(k, String(v));
            }
        }
    }

    const res = await fetch(url.toString(), {
        method,
        headers: {
            Authorization: getAuthHeader(publicKey, secretKey),
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        // Pas du JSON — on garde le text brut pour le debug
    }

    if (!res.ok) {
        // Format d'erreur Sendcloud variable selon endpoint :
        // { error: { code, message } } ou { detail: "..." } ou tableau d'erreurs
        const err = parsed as
            | { error?: { code?: string; message?: string }; detail?: string }
            | null;
        const message = err?.error?.message ?? err?.detail ?? `HTTP ${res.status}`;
        const errorCode = err?.error?.code ?? null;

        throw new SendcloudError(
            `Sendcloud ${method} ${path} failed: ${message}`,
            res.status,
            errorCode,
            parsed ?? text
        );
    }

    const validated = options.responseSchema.safeParse(parsed);
    if (!validated.success) {
        // Print le brut pour debug — la réponse Sendcloud peut varier légèrement
        // sur certains champs optionnels selon le carrier
        console.error(
            `Sendcloud ${method} ${path} response schema mismatch:`,
            JSON.stringify(parsed, null, 2)
        );
        throw new SendcloudError(
            `Sendcloud ${method} ${path} zod validation failed: ${validated.error.message}`,
            null,
            null,
            parsed
        );
    }
    return validated.data;
}