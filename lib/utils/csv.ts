/**
 * Convertit un array d'objets en CSV avec :
 * - séparateur point-virgule (compatibilité Excel FR/BE par défaut)
 * - retour ligne CRLF (\r\n, standard Windows attendu par Excel)
 * - BOM UTF-8 pour qu'Excel détecte correctement les accents
 */
export function toCSV<T extends Record<string, unknown>>(
    rows: T[],
    columns: { key: keyof T; label: string }[]
): string {
    const SEP = ";";
    const EOL = "\r\n";

    const header = columns.map((c) => escapeCSV(c.label, SEP)).join(SEP);
    const lines = rows.map((row) =>
        columns.map((c) => escapeCSV(row[c.key], SEP)).join(SEP)
    );
    return "\uFEFF" + [header, ...lines].join(EOL) + EOL;
}

function escapeCSV(value: unknown, sep: string): string {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (s.includes(sep) || /[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}