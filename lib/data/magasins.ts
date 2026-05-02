import { createClient } from "@/lib/supabase/server";
import {
    MagasinSchema,
    type Magasin,
    type MagasinsFilter,
} from "@/lib/schemas/magasin";

const PROVINCE_VALUES = [
    "hainaut",
    "liege",
    "namur",
    "luxembourg",
    "brabant-wallon",
] as const;
type Province = (typeof PROVINCE_VALUES)[number];

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

function mapToMagasin(row: any): Magasin | null {
    try {
        const details = row.magasin_details ?? {};
        return MagasinSchema.parse({
            id: row.id,
            slug: row.slug,
            nom: row.name,
            description: row.description ?? "",
            pays: row.country,
            province: normalizeProvince(row.region),
            ville: row.city ?? "",
            adresse: row.address ?? "",
            specialites: details.specialites?.length
                ? details.specialites
                : ["general"],
            marques: details.marques ?? [],
            horaires: details.horaires?.texte ?? "",
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
                telephone: row.contact_phone ?? undefined,
                email: row.contact_email ?? undefined,
                siteWeb: row.website ?? undefined,
                instagram: row.social_instagram ?? undefined,
            },
            partenaire: details.plan === "pro" || details.plan === "boutique_plus",
            noteMoyenne: undefined,
            nbAvis: 0,
        });
    } catch (e) {
        console.error("[magasins] mapToMagasin skipped row:", row.slug, e);
        return null;
    }
}

export async function getMagasins(
    filter: MagasinsFilter = {}
): Promise<Magasin[]> {
    const supabase = await createClient();

    let query = supabase
        .from("organizations")
        .select("*, magasin_details!inner(*)")
        .eq("org_type", "magasin")
        .eq("status", "active")
        .is("deleted_at", null);

    if (filter.pays) query = query.eq("country", filter.pays);
    if (filter.province) query = query.eq("region", filter.province);
    if (filter.partenaireOnly)
        query = query.in("magasin_details.plan", ["pro", "boutique_plus"]);

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
        console.error("getMagasins failed:", error);
        return [];
    }

    let rows = (data ?? [])
        .map(mapToMagasin)
        .filter((m): m is Magasin => m !== null);

    if (filter.specialite) {
        rows = rows.filter((m) => m.specialites.includes(filter.specialite!));
    }

    return rows;
}

export async function getMagasinBySlug(slug: string): Promise<Magasin | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("organizations")
        .select("*, magasin_details!inner(*)")
        .eq("org_type", "magasin")
        .eq("slug", slug)
        .eq("status", "active")
        .is("deleted_at", null)
        .single();

    if (error || !data) return null;
    return mapToMagasin(data);
}