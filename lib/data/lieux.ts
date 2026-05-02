import { createClient } from "@/lib/supabase/server";
import {
    LieuSchema,
    type Lieu,
    type LieuxFilter,
    type Province,
} from "@/lib/schemas/lieu";

const PROVINCE_VALUES = [
    "hainaut",
    "liege",
    "namur",
    "luxembourg",
    "brabant-wallon",
] as const;

/**
 * Normalise un champ region libre (texte) vers le slug de province attendu
 * par le schéma. Tolère majuscules, accents, espaces.
 */
function normalizeProvince(input: string | null | undefined): Province {
    if (!input) return "hainaut";
    const slug = input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .trim();
    if (PROVINCE_VALUES.includes(slug as Province)) {
        return slug as Province;
    }
    return "hainaut";
}

function mapToLieu(row: any): Lieu | null {
    try {
        const details = row.etang_details ?? {};
        return LieuSchema.parse({
            id: row.id,
            slug: row.slug,
            nom: row.name,
            description: row.description ?? "",
            pays: row.country,
            province: normalizeProvince(row.region),
            commune: row.city ?? "",
            superficieHa: Number(details.superficie_ha ?? 0),
            profondeurMaxM: details.profondeur_max_m
                ? Number(details.profondeur_max_m)
                : undefined,
            especes: details.especes ?? [],
            reglement: details.reglement ?? {
                noKill: false,
                baitboatAutorise: false,
                nuitAutorisee: false,
                nbCannesMax: 1,
                permisRequis: true,
            },
            tarif: {
                jour: details.tarif_journee_cents
                    ? details.tarif_journee_cents / 100
                    : 0,
            },
            recordKg: details.record_kg ? Number(details.record_kg) : undefined,
            postesCount: details.postes_count ?? 0,
            photos: row.photos?.length
                ? row.photos
                : row.cover_image_url
                    ? [row.cover_image_url]
                    : [],
            coordonnees: {
                lat: row.lat ? Number(row.lat) : 0,
                lng: row.lng ? Number(row.lng) : 0,
            },
            contact: {
                email: row.contact_email ?? undefined,
                telephone: row.contact_phone ?? undefined,
                siteWeb: row.website ?? undefined,
            },
            reservable: details.reservation_active ?? false,
            noteMoyenne: undefined,
            nbAvis: 0,
        });
    } catch (e) {
        console.error("[lieux] mapToLieu skipped row:", row.slug, e);
        return null;
    }
}

export async function getLieux(filter: LieuxFilter = {}): Promise<Lieu[]> {
    const supabase = await createClient();

    let query = supabase
        .from("organizations")
        .select("*, etang_details!inner(*)")
        .eq("org_type", "etang")
        .eq("status", "active")
        .is("deleted_at", null);

    if (filter.pays) query = query.eq("country", filter.pays);
    if (filter.province) query = query.eq("region", filter.province);
    if (filter.reservableOnly)
        query = query.eq("etang_details.reservation_active", true);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
        console.error("getLieux failed:", error);
        return [];
    }

    let rows = (data ?? [])
        .map(mapToLieu)
        .filter((l): l is Lieu => l !== null);

    if (filter.espece) {
        rows = rows.filter((l) => l.especes.includes(filter.espece!));
    }

    return rows;
}

export async function getLieuBySlug(slug: string): Promise<Lieu | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("organizations")
        .select("*, etang_details!inner(*)")
        .eq("org_type", "etang")
        .eq("slug", slug)
        .eq("status", "active")
        .is("deleted_at", null)
        .single();

    if (error || !data) return null;
    return mapToLieu(data);
}