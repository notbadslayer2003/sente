"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult =
    | { ok: true }
    | { ok: false; error: string };

const EspecesEnum = z.enum([
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

const EtangDetailsSchema = z.object({
    org_id: z.string().uuid(),
    especes: z.array(EspecesEnum).max(15),
    superficie_ha: z
        .union([z.coerce.number().positive(), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    profondeur_max_m: z
        .union([z.coerce.number().positive(), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    record_kg: z
        .union([z.coerce.number().positive(), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    tarif_journee_cents: z
        .union([z.coerce.number().int().min(0).max(100000), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    tarif_annee_cents: z
        .union([z.coerce.number().int().min(0).max(1000000), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    reservation_active: z.preprocess(
        (v) => v === "on" || v === true,
        z.boolean()
    ),
});

export async function updateEtangDetailsAction(
    formData: FormData
): Promise<ActionResult> {
    // Récupère les espèces (multi-input avec même name)
    const especes = formData.getAll("especes").map(String);
    // Tarifs : on reçoit des EUR, on stocke en cents
    const tarifJourneeEur = formData.get("tarif_journee_eur");
    const tarifAnneeEur = formData.get("tarif_annee_eur");
    const tarif_journee_cents =
        tarifJourneeEur && tarifJourneeEur !== ""
            ? Math.round(Number(tarifJourneeEur) * 100)
            : "";
    const tarif_annee_cents =
        tarifAnneeEur && tarifAnneeEur !== ""
            ? Math.round(Number(tarifAnneeEur) * 100)
            : "";

    const raw = {
        org_id: formData.get("org_id"),
        especes,
        superficie_ha: formData.get("superficie_ha") ?? "",
        profondeur_max_m: formData.get("profondeur_max_m") ?? "",
        record_kg: formData.get("record_kg") ?? "",
        tarif_journee_cents,
        tarif_annee_cents,
        reservation_active: formData.get("reservation_active"),
    };

    const parsed = EtangDetailsSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false,
            error:
                parsed.error.issues[0]?.message ?? "Vérifie les valeurs entrées",
        };
    }

    const { org_id, ...fields } = parsed.data;
    const supabase = await createClient();

    const { error } = await supabase
        .from("etang_details")
        .update(fields)
        .eq("organization_id", org_id);

    if (error) {
        console.error("updateEtangDetails failed:", error);
        return { ok: false, error: "Impossible de sauvegarder." };
    }

    revalidatePath("/dashboard/[slug]", "page");
    revalidatePath("/dashboard/[slug]/fiche", "page");
    revalidatePath("/lieux/[slug]", "page");
    revalidatePath("/lieux", "page");
    return { ok: true };
}

const MagasinDetailsSchema = z.object({
    org_id: z.string().uuid(),
    specialites: z.array(z.string().min(1).max(50)).max(10),
    marques: z.array(z.string().min(1).max(100)).max(50),
    horaires_texte: z.string().max(2000).optional(),
});

export async function updateMagasinDetailsAction(
    formData: FormData
): Promise<ActionResult> {
    const specialites = formData.getAll("specialites").map(String);
    const marques = formData.getAll("marques").map(String);

    const raw = {
        org_id: formData.get("org_id"),
        specialites,
        marques,
        horaires_texte: formData.get("horaires_texte") || undefined,
    };

    const parsed = MagasinDetailsSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Champs invalides",
        };
    }

    const supabase = await createClient();

    // On stocke les horaires dans le champ jsonb { texte: ... }
    const { error } = await supabase
        .from("magasin_details")
        .update({
            specialites: parsed.data.specialites,
            marques: parsed.data.marques,
            horaires: { texte: parsed.data.horaires_texte ?? "" },
        })
        .eq("organization_id", parsed.data.org_id);

    if (error) {
        console.error("updateMagasinDetails failed:", error);
        return { ok: false, error: "Impossible de sauvegarder." };
    }

    revalidatePath("/dashboard/[slug]", "page");
    revalidatePath("/dashboard/[slug]/fiche", "page");
    revalidatePath("/magasins/[slug]", "page");
    revalidatePath("/magasins", "page");
    return { ok: true };
}