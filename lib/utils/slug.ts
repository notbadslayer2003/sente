/**
 * Génère un slug à partir d'un nom : minuscules, accents virés, espaces → tirets,
 * caractères non alphanumériques retirés, tirets multiples collapsés.
 * Doit matcher la regex côté SQL : ^[a-z0-9]+(?:-[a-z0-9]+)*$
 */
export function slugify(input: string): string {
    return input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // accents
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 100);
}