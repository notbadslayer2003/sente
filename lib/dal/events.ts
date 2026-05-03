import { createClient } from "@/lib/supabase/server";

export type EventListItem = {
    id: string;
    title: string;
    description: string | null;
    event_type: string;
    starts_at: string;
    ends_at: string | null;
    location_text: string | null;
    cover_image_url: string | null;
    price_cents: number;
    max_participants: number | null;
    registrations_count: number;
    espece_cible: string | null;
    niveau: string | null;
    status: string;
    cancellation_reason: string | null;
    organization: {
        id: string;
        slug: string;
        name: string;
        org_type: string;
        cover_image_url: string | null;
    };
};

export type EventDetail = EventListItem & {
    materiel_fourni: string | null;
    materiel_a_apporter: string | null;
    location_lat: number | null;
    location_lng: number | null;
    commission_rate_bps: number | null;
    is_registered_by_me: boolean;
    is_org_member: boolean;
    cancelled_at: string | null;
};

const SELECT_LIST = `
    id, title, description, event_type, starts_at, ends_at,
    location_text, cover_image_url, price_cents,
    max_participants, registrations_count,
    espece_cible, niveau, status, cancellation_reason,
    organization:organizations!organization_id(id, slug, name, org_type, cover_image_url)
`;

const SELECT_DETAIL = `
    id, title, description, event_type, starts_at, ends_at,
    location_text, location_lat, location_lng,
    cover_image_url, price_cents, commission_rate_bps,
    max_participants, registrations_count,
    espece_cible, niveau, materiel_fourni, materiel_a_apporter,
    status, cancellation_reason, cancelled_at,
    organization:organizations!organization_id(id, slug, name, org_type, cover_image_url)
`;

function mapRow(r: unknown): EventListItem | null {
    const row = r as {
        id: string; title: string; description: string | null;
        event_type: string; starts_at: string; ends_at: string | null;
        location_text: string | null; cover_image_url: string | null;
        price_cents: number; max_participants: number | null;
        registrations_count: number;
        espece_cible: string | null; niveau: string | null;
        status: string; cancellation_reason: string | null;
        organization: { id: string; slug: string; name: string; org_type: string; cover_image_url: string | null }
            | { id: string; slug: string; name: string; org_type: string; cover_image_url: string | null }[]
            | null;
    };
    const org = Array.isArray(row.organization) ? row.organization[0] : row.organization;
    if (!org) return null;
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        event_type: row.event_type,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        location_text: row.location_text,
        cover_image_url: row.cover_image_url,
        price_cents: row.price_cents,
        max_participants: row.max_participants,
        registrations_count: row.registrations_count,
        espece_cible: row.espece_cible,
        niveau: row.niveau,
        status: row.status,
        cancellation_reason: row.cancellation_reason,
        organization: org,
    };
}

export async function getUpcomingEvents(opts: {
    limit?: number;
    orgId?: string;
}): Promise<EventListItem[]> {
    const limit = opts.limit ?? 30;
    const supabase = await createClient();

    let q = supabase
        .from("events")
        .select(SELECT_LIST)
        .eq("status", "published")
        .is("deleted_at", null)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(limit);

    if (opts.orgId) q = q.eq("organization_id", opts.orgId);

    const { data, error } = await q;
    if (error || !data) {
        if (error) console.error("getUpcomingEvents:", error);
        return [];
    }
    return data.map(mapRow).filter((e): e is EventListItem => e !== null);
}

export async function getEventsByOrg(opts: {
    orgId: string;
    includeAll?: boolean; // true = inclut draft + cancelled (côté dashboard)
}): Promise<EventListItem[]> {
    const supabase = await createClient();
    let q = supabase
        .from("events")
        .select(SELECT_LIST)
        .eq("organization_id", opts.orgId)
        .is("deleted_at", null)
        .order("starts_at", { ascending: false })
        .limit(100);

    if (!opts.includeAll) {
        q = q.eq("status", "published").gte("starts_at", new Date().toISOString());
    }

    const { data, error } = await q;
    if (error || !data) return [];
    return data.map(mapRow).filter((e): e is EventListItem => e !== null);
}

export async function getEventDetail(eventId: string): Promise<EventDetail | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from("events")
        .select(SELECT_DETAIL)
        .eq("id", eventId)
        .is("deleted_at", null)
        .maybeSingle();

    if (error || !data) return null;

    const base = mapRow(data);
    if (!base) return null;

    const row = data as unknown as {
        location_lat: number | null;
        location_lng: number | null;
        materiel_fourni: string | null;
        materiel_a_apporter: string | null;
        cancelled_at: string | null;
        commission_rate_bps: number | null;
    };

    let isRegistered = false;
    let isOrgMember = false;
    if (user) {
        const { data: reg } = await supabase
            .from("event_registrations")
            .select("id")
            .eq("event_id", eventId)
            .eq("user_id", user.id)
            .maybeSingle();
        isRegistered = !!reg;

        const { data: m } = await supabase
            .from("memberships")
            .select("role")
            .eq("organization_id", base.organization.id)
            .eq("user_id", user.id)
            .not("accepted_at", "is", null)
            .maybeSingle();
        isOrgMember = !!m;
    }

    return {
        ...base,
        location_lat: row.location_lat,
        location_lng: row.location_lng,
        materiel_fourni: row.materiel_fourni,
        materiel_a_apporter: row.materiel_a_apporter,
        cancelled_at: row.cancelled_at,
        commission_rate_bps: row.commission_rate_bps,
        is_registered_by_me: isRegistered,
        is_org_member: isOrgMember,
    };
}