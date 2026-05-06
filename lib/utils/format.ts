/**
 * Formate un montant en cents en euros avec virgule.
 * - 100 → "1,00 €"
 * - 12999 → "129,99 €"
 * - 0 → "Gratuit"
 *
 * @param cents Montant en centimes d'euro
 * @param opts.showFree Si true, affiche "Gratuit" pour 0. Défaut true.
 */
export function formatPriceEur(
    cents: number,
    opts: { showFree?: boolean } = {}
): string {
    const showFree = opts.showFree ?? true;
    if (cents === 0 && showFree) return "Gratuit";

    const euros = cents / 100;
    return new Intl.NumberFormat("fr-BE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(euros);
}

/**
 * Formate une fourchette de prix : "12,99 € – 24,99 €" ou juste "12,99 €" si min === max.
 */
export function formatPriceRangeEur(minCents: number, maxCents: number): string {
    if (minCents === maxCents) return formatPriceEur(minCents, { showFree: false });
    return `${formatPriceEur(minCents, { showFree: false })} – ${formatPriceEur(maxCents, { showFree: false })}`;
}

/**
 * Affichage stock : "12 en stock", "Rupture", "Stock illimité".
 */
export function formatStockLabel(qty: number | null): string {
    if (qty === null) return "Stock illimité";
    if (qty === 0) return "Rupture";
    if (qty === 1) return "1 en stock";
    return `${qty} en stock`;
}

/**
 * Conversion safe euros (string formulaire) → cents (int DB).
 * Accepte "12", "12.50", "12,50", " 12 €" → renvoie 1200, 1250, 1250, 1200.
 * Renvoie null si parsing échoue.
 */
export function eurStringToCents(input: string): number | null {
    if (!input || typeof input !== "string") return null;
    const cleaned = input
        .replace(/€/g, "")
        .replace(/\s/g, "")
        .replace(",", ".")
        .trim();
    if (cleaned === "") return null;
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100);
}

/**
 * Conversion cents → string euros sans symbole pour input controlled.
 * 1250 → "12.50"
 */
export function centsToEurInput(cents: number): string {
    return (cents / 100).toFixed(2);
}