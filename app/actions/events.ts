"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const EventTypeEnum = z.enum([
    "concours",
    "journee_decouverte",
    "stage",
    "assemblee",
    "autre",
]);

const EspeceEnum = z.enum([
    "carpe",
    "silure",
    "brochet",
    "sandre",
    "perche",
    "truite",
    "black_bass",
    "gardon",
    "tanche",
    "esturgeon",
    "salmonide",
    "carnassier",
    "blanc",
]);

const NiveauEnum = z.enum(["debutant", "intermediaire", "expert", "tous_niveaux"]);

const EventInputSchema = z.object({
    organization_id: z.string().uuid(),
    title: z.string().min(3, "Titre trop court").max(200, "Titre trop long").transform((v) => v.trim()),
    description: z
        .union([z.string().max(4000), z.literal(""), z.null()])
        .optional()
        .transform((v) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null)),
    event_type: EventTypeEnum.optional().default("autre"),
    starts_at: z.string().min(1, "Date de début requise"),
    ends_at: z
        .union([z.string(), z.null()])
        .optional()
        .transform((v) => (v && v.length > 0 ? v : null)),
    location_text: z
        .union([z.string().max(300), z.literal(""), z.null()])
        .optional()
        .transform((v) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null)),
    location_lat: z.coerce.number().min(-90).max(90).optional().nullable(),
    location_lng: z.coerce.number().min(-180).max(180).optional().nullable(),
    max_participants: z.coerce.number().int().min(1).optional().nullable(),
    price_cents: z.coerce.number().int().min(0),
    commission_rate_bps: z.coerce.number().int().min(0).max(5000).optional().nullable(),
    espece_cible: z
        .union([EspeceEnum, z.literal(""), z.null()])
        .optional()
        .transform((v) => (typeof v === "string" && v.length > 0 ? (v as z.infer<typeof EspeceEnum>) : null)),
    niveau: z
        .union([NiveauEnum, z.literal(""), z.null()])
        .optional()
        .transform((v) => (typeof v === "string" && v.length > 0 ? (v as z.infer<typeof NiveauEnum>) : null)),
    materiel_fourni: z
        .union([z.string().max(1000), z.literal(""), z.null()])
        .optional()
        .transform((v) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null)),
    materiel_a_apporter: z
        .union([z.string().max(1000), z.literal(""), z.null()])
        .optional()
        .transform((v) => (typeof v === "string" && v.trim().length > 0 ? v.trim() : null)),
    cover_image_url: z
        .union([z.string().url(), z.literal(""), z.null()])
        .optional()
        .transform((v) => (typeof v === "string" && v.length > 0 ? v : null)),
    publish_now: z.coerce.boolean().optional().default(false),
});

function pickPriceCents(formData: FormData): number {
    const rawEur = formData.get("price_eur");
    if (rawEur && rawEur !== "") {
        const eur = parseFloat(String(rawEur));
        if (!Number.isNaN(eur)) return Math.round(eur * 100);
    }
    return 0;
}

function pickCommissionBps(formData: FormData): number | null {
    const raw = formData.get("commission_rate_pct");
    if (!raw || raw === "") return null;
    const pct = parseFloat(String(raw));
    if (Number.isNaN(pct)) return null;
    return Math.round(pct * 100);
}

export async function createEventAction(
    formData: FormData
): Promise<ActionResult<{ event_id: string }>> {
    const raw = {
        organization_id: formData.get("organization_id"),
        title: formData.get("title"),
        description: formData.get("description") ?? undefined,
        event_type: formData.get("event_type") ?? undefined,
        starts_at: formData.get("starts_at"),
        ends_at: formData.get("ends_at") ?? undefined,
        location_text: formData.get("location_text") ?? undefined,
        location_lat: formData.get("location_lat") ?? undefined,
        location_lng: formData.get("location_lng") ?? undefined,
        max_participants: formData.get("max_participants") ?? undefined,
        price_cents: pickPriceCents(formData),
        commission_rate_bps: pickCommissionBps(formData),
        espece_cible: formData.get("espece_cible") ?? undefined,
        niveau: formData.get("niveau") ?? undefined,
        materiel_fourni: formData.get("materiel_fourni") ?? undefined,
        materiel_a_apporter: formData.get("materiel_a_apporter") ?? undefined,
        cover_image_url: formData.get("cover_image_url") ?? undefined,
        publish_now: formData.get("publish_now") === "true",
    };

    const parsed = EventInputSchema.safeParse(raw);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
        .rpc("create_event", {
            p_organization_id: parsed.data.organization_id,
            p_title: parsed.data.title,
            p_description: parsed.data.description,
            p_event_type: parsed.data.event_type,
            p_starts_at: parsed.data.starts_at,
            p_ends_at: parsed.data.ends_at,
            p_location_text: parsed.data.location_text,
            p_location_lat: parsed.data.location_lat,
            p_location_lng: parsed.data.location_lng,
            p_max_participants: parsed.data.max_participants,
            p_price_cents: parsed.data.price_cents,
            p_commission_rate_bps: parsed.data.commission_rate_bps,
            p_espece_cible: parsed.data.espece_cible,
            p_niveau: parsed.data.niveau,
            p_materiel_fourni: parsed.data.materiel_fourni,
            p_materiel_a_apporter: parsed.data.materiel_a_apporter,
            p_cover_image_url: parsed.data.cover_image_url,
            p_publish_now: parsed.data.publish_now,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .single();

    if (error) {
        console.error("create_event failed:", error);
        return { ok: false, error: humanizeEventError(error.message) };
    }

    revalidatePath("/dashboard/[slug]/evenements", "page");
    revalidatePath("/evenements");
    return { ok: true, data: { event_id: data as unknown as string } };
}

const UpdateEventSchema = EventInputSchema.omit({ organization_id: true, publish_now: true }).extend({
    event_id: z.string().uuid(),
});

export async function updateEventAction(
    formData: FormData
): Promise<ActionResult> {
    const raw = {
        event_id: formData.get("event_id"),
        title: formData.get("title"),
        description: formData.get("description") ?? undefined,
        event_type: formData.get("event_type") ?? undefined,
        starts_at: formData.get("starts_at"),
        ends_at: formData.get("ends_at") ?? undefined,
        location_text: formData.get("location_text") ?? undefined,
        location_lat: formData.get("location_lat") ?? undefined,
        location_lng: formData.get("location_lng") ?? undefined,
        max_participants: formData.get("max_participants") ?? undefined,
        price_cents: pickPriceCents(formData),
        commission_rate_bps: pickCommissionBps(formData),
        espece_cible: formData.get("espece_cible") ?? undefined,
        niveau: formData.get("niveau") ?? undefined,
        materiel_fourni: formData.get("materiel_fourni") ?? undefined,
        materiel_a_apporter: formData.get("materiel_a_apporter") ?? undefined,
        cover_image_url: formData.get("cover_image_url") ?? undefined,
    };

    const parsed = UpdateEventSchema.safeParse(raw);
    if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("update_event", {
        p_event_id: parsed.data.event_id,
        p_title: parsed.data.title,
        p_description: parsed.data.description,
        p_event_type: parsed.data.event_type,
        p_starts_at: parsed.data.starts_at,
        p_ends_at: parsed.data.ends_at,
        p_location_text: parsed.data.location_text,
        p_location_lat: parsed.data.location_lat,
        p_location_lng: parsed.data.location_lng,
        p_max_participants: parsed.data.max_participants,
        p_price_cents: parsed.data.price_cents,
        p_commission_rate_bps: parsed.data.commission_rate_bps,
        p_espece_cible: parsed.data.espece_cible,
        p_niveau: parsed.data.niveau,
        p_materiel_fourni: parsed.data.materiel_fourni,
        p_materiel_a_apporter: parsed.data.materiel_a_apporter,
        p_cover_image_url: parsed.data.cover_image_url,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    if (error) {
        console.error("update_event failed:", error);
        return { ok: false, error: humanizeEventError(error.message) };
    }

    revalidatePath("/dashboard/[slug]/evenements", "page");
    revalidatePath("/evenements/[id]", "page");
    revalidatePath("/evenements");
    return { ok: true };
}

const PublishSchema = z.object({ event_id: z.string().uuid() });

export async function publishEventAction(formData: FormData): Promise<ActionResult> {
    const parsed = PublishSchema.safeParse({ event_id: formData.get("event_id") });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("publish_event", { p_event_id: parsed.data.event_id });
    if (error) return { ok: false, error: humanizeEventError(error.message) };

    revalidatePath("/dashboard/[slug]/evenements", "page");
    revalidatePath("/evenements");
    return { ok: true };
}

const CancelSchema = z.object({
    event_id: z.string().uuid(),
    reason: z.string().min(10, "Raison trop courte (min 10 caractères)").max(1000),
});

export async function cancelEventAction(formData: FormData): Promise<ActionResult> {
    const parsed = CancelSchema.safeParse({
        event_id: formData.get("event_id"),
        reason: formData.get("reason"),
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_event", {
        p_event_id: parsed.data.event_id,
        p_reason: parsed.data.reason,
    });
    if (error) return { ok: false, error: humanizeEventError(error.message) };

    revalidatePath("/dashboard/[slug]/evenements", "page");
    revalidatePath("/evenements/[id]", "page");
    revalidatePath("/evenements");
    return { ok: true };
}

export async function deleteDraftEventAction(formData: FormData): Promise<ActionResult> {
    const parsed = PublishSchema.safeParse({ event_id: formData.get("event_id") });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_event_draft", { p_event_id: parsed.data.event_id });
    if (error) return { ok: false, error: humanizeEventError(error.message) };

    revalidatePath("/dashboard/[slug]/evenements", "page");
    return { ok: true };
}

function humanizeEventError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("titre invalide")) return "Titre invalide (3-200 caractères).";
    if (lower.includes("date de début doit être dans le futur")) return "La date de début doit être dans le futur.";
    if (lower.includes("date de fin doit être après")) return "La date de fin doit être après la date de début.";
    if (lower.includes("prix invalide")) return "Prix invalide.";
    if (lower.includes("capacité invalide")) return "Capacité invalide.";
    if (lower.includes("commission invalide")) return "Taux de commission invalide.";
    if (lower.includes("organisation n'est pas active")) return "Ton organisation n'est pas validée.";
    if (lower.includes("owner ou admin")) return "Tu n'es pas owner ou admin de cette organisation.";
    if (lower.includes("brouillon peut être publié")) return "Seul un brouillon peut être publié.";
    if (lower.includes("événement a déjà commencé")) return "Cet événement a déjà commencé.";
    if (lower.includes("inscriptions") && lower.includes("payées")) return "Le prix ne peut plus changer, des inscriptions ont été payées.";
    if (lower.includes("brouillon") && lower.includes("supprim")) return "Seuls les brouillons peuvent être supprimés. Annule l'événement à la place.";
    if (lower.includes("inscriptions")) return "Impossible de supprimer : il y a des inscriptions.";
    if (lower.includes("déjà annulé")) return "Événement déjà annulé.";
    if (lower.includes("déjà terminé")) return "Événement déjà terminé.";
    if (lower.includes("raison d'annulation requise")) return "Raison d'annulation requise (min 10 caractères).";
    return msg;
}