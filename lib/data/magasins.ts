import { MOCK_MAGASINS } from "@/lib/mock/magasins";
import {
    MagasinSchema,
    type Magasin,
    type MagasinsFilter,
} from "@/lib/schemas/magasin";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getMagasins(
    filter: MagasinsFilter = {}
): Promise<Magasin[]> {
    await delay(150);
    let rows = MOCK_MAGASINS;
    if (filter.pays) {
        rows = rows.filter((m) => m.pays === filter.pays);
    }
    if (filter.specialite) {
        rows = rows.filter((m) => m.specialites.includes(filter.specialite!));
    }
    if (filter.province) {
        rows = rows.filter((m) => m.province === filter.province);
    }
    if (filter.partenaireOnly) {
        rows = rows.filter((m) => m.partenaire);
    }
    return rows.map((m) => MagasinSchema.parse(m));
}

export async function getMagasinBySlug(slug: string): Promise<Magasin | null> {
    await delay(120);
    const found = MOCK_MAGASINS.find((m) => m.slug === slug);
    if (!found) return null;
    return MagasinSchema.parse(found);
}