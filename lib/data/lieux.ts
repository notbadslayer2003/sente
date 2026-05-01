import { MOCK_LIEUX } from "@/lib/mock/lieux";
import {
    LieuSchema,
    type Lieu,
    type LieuxFilter,
} from "@/lib/schemas/lieu";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getLieux(filter: LieuxFilter = {}): Promise<Lieu[]> {
    await delay(150);
    let rows = MOCK_LIEUX;
    if (filter.pays) {
        rows = rows.filter((l) => l.pays === filter.pays);
    }
    if (filter.espece) {
        rows = rows.filter((l) => l.especes.includes(filter.espece!));
    }
    if (filter.province) {
        rows = rows.filter((l) => l.province === filter.province);
    }
    if (filter.reservableOnly) {
        rows = rows.filter((l) => l.reservable);
    }
    return rows.map((l) => LieuSchema.parse(l));
}

export async function getLieuBySlug(slug: string): Promise<Lieu | null> {
    await delay(120);
    const found = MOCK_LIEUX.find((l) => l.slug === slug);
    if (!found) return null;
    return LieuSchema.parse(found);
}