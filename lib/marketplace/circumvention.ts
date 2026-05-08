// =============================================================================
// Détection anti-désintermédiation (emails / téléphones dans les messages)
// =============================================================================
// Approche soft-block : on ne bloque pas l'envoi, on flag le message pour
// modération admin et on archive le raw_body. Le buyer/seller voit son message
// passer normalement.
//
// La détection est volontairement pragmatique :
// - emails : pattern classique avec @ et TLD
// - téléphones : 8+ chiffres consécutifs (avec séparateurs tolérés), ou
//   préfixe international (+32, +33, +X)
// =============================================================================

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// 8+ chiffres avec séparateurs tolérés (espace, point, tiret, slash, parenthèses)
// Ou préfixe + suivi de 6+ chiffres
const PHONE_REGEX =
    /(?:\+\d{1,3}[\s.\-]?(?:\(?\d{1,4}\)?[\s.\-]?){2,5}\d{2,4}|(?:\d[\s.\-]?){8,}\d)/g;

export type CircumventionMatches = {
    emails: string[];
    phones: string[];
};

export type CircumventionResult = {
    flagged: boolean;
    matches: CircumventionMatches;
};

/**
 * Analyse un message pour détecter une tentative de contournement
 * (emails ou numéros de téléphone). Ne bloque pas l'envoi : retourne un flag.
 */
export function detectCircumvention(body: string): CircumventionResult {
    const emails = (body.match(EMAIL_REGEX) ?? []).map((m) => m.toLowerCase());

    // Phone regex peut matcher dans des emails — on filtre les phones qui
    // chevauchent un email
    const phonesRaw = body.match(PHONE_REGEX) ?? [];
    const phones = phonesRaw.filter((p) => {
        // Ne pas compter si le pattern apparaît à l'intérieur d'un email détecté
        return !emails.some((e) => e.includes(p));
    });

    return {
        flagged: emails.length > 0 || phones.length > 0,
        matches: { emails, phones },
    };
}