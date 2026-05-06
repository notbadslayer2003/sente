import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

/**
 * Rate limiter Upstash. Utilise sliding window pour des limites
 * lissées dans le temps (plus juste que fixed window).
 *
 * Les limiters sont pré-instanciés une fois et réutilisés (cache interne).
 * Chaque cas d'usage a son propre prefix Redis pour isolation.
 */
const redis = Redis.fromEnv();

export const rateLimiters = {
    /** Forgot password : 3 tentatives par email / heure */
    forgotPasswordByEmail: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        prefix: "rl:forgot-pwd:email",
        analytics: false,
    }),
    /** Forgot password : 10 tentatives par IP / heure */
    forgotPasswordByIp: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 h"),
        prefix: "rl:forgot-pwd:ip",
        analytics: false,
    }),
    /** Login : 10 tentatives par IP / 15 min (anti brute-force) */
    loginByIp: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "15 m"),
        prefix: "rl:login:ip",
        analytics: false,
    }),
} as const;

/**
 * Récupère l'IP du client depuis les headers Next.js.
 * Vercel injecte x-forwarded-for. Fallback "unknown" en local.
 */
export async function getClientIp(): Promise<string> {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) {
        return forwarded.split(",")[0]?.trim() ?? "unknown";
    }
    const realIp = h.get("x-real-ip");
    if (realIp) return realIp;
    return "unknown";
}

export type RateLimitCheckResult =
    | { ok: true }
    | { ok: false; error: string; retryAfterSeconds: number };

/**
 * Helper : check le rate limit, formatte un message d'erreur.
 * Retourne ok=true si autorisé, ok=false avec retryAfterSeconds sinon.
 */
export async function checkRateLimit(
    limiter: Ratelimit,
    key: string,
    tooManyMessage = "Trop de tentatives. Réessaie plus tard."
): Promise<RateLimitCheckResult> {
    const { success, reset } = await limiter.limit(key);
    if (success) return { ok: true };

    const retryAfterSeconds = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
    return {
        ok: false,
        error: tooManyMessage,
        retryAfterSeconds,
    };
}