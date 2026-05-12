import {
    AsYouType,
    parsePhoneNumberFromString,
    isValidPhoneNumber as libIsValidPhone,
    type CountryCode,
} from "libphonenumber-js/min";

export type PhoneCountry = "BE" | "FR";

export const PHONE_COUNTRIES: { code: PhoneCountry; label: string; dial: string }[] = [
    { code: "BE", label: "Belgique", dial: "+32" },
    { code: "FR", label: "France", dial: "+33" },
];

/**
 * Tente de parser un numéro et retourne sa version E.164 (+32477123456) ou null si invalide.
 * Utilisé côté serveur pour stocker en DB.
 */
export function toE164(value: string, country: PhoneCountry = "BE"): string | null {
    if (!value || !value.trim()) return null;
    const parsed = parsePhoneNumberFromString(value, country as CountryCode);
    return parsed?.isValid() ? parsed.number : null;
}

/**
 * Retourne le numéro formaté en national (ex: "0477 12 34 56") ou la valeur brute.
 * Utilisé pour l'affichage initial dans un input pré-rempli.
 */
export function toNationalDisplay(e164: string | null | undefined): string {
    if (!e164) return "";
    const parsed = parsePhoneNumberFromString(e164);
    return parsed?.isValid() ? parsed.formatNational() : e164;
}

/**
 * Détecte le pays d'un numéro E.164 stocké en DB.
 */
export function detectCountry(e164: string | null | undefined): PhoneCountry {
    if (!e164) return "BE";
    const parsed = parsePhoneNumberFromString(e164);
    if (parsed?.country === "FR") return "FR";
    return "BE";
}

/** Valide un E.164 côté serveur (zod). */
export function isValidPhone(value: string): boolean {
    return libIsValidPhone(value);
}

/** Formate "AsYouType" pour usage client. */
export function formatAsYouType(value: string, country: PhoneCountry): string {
    const formatter = new AsYouType(country as CountryCode);
    return formatter.input(value);
}