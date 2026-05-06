"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {toCSV} from "@/lib/utils/csv";
import { canChargeOnline } from "@/lib/dal/feature-gate";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const PaymentMethodEnum = z.enum([
    "online_card",
    "cash",
    "virement",
    "cheque",
    "autre",
]);

const PaymentStatusEnum = z.enum([
    "pending",
    "partial",
    "paid",
    "refunded",
    "cancelled",
    "failed",
]);

const PeriodTypeEnum = z.enum([
    "annuel",
    "semestre",
    "trimestre",
    "mensuel",
    "autre",
]);

const SubscriptionBaseSchema = z.object({
    etang_id: z.string().uuid(),
    pecheur_full_name: z
        .string()
        .min(2, "Nom trop court")
        .max(100, "Nom trop long")
        .transform((v) => v.trim()),
    pecheur_email: z
        .union([z.string().email("Email invalide"), z.literal("")])
        .optional()
        .transform((v) => (v && v.length > 0 ? v.toLowerCase() : null)),
    pecheur_phone: z
        .string()
        .max(30)
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
    saison_year: z.coerce
        .number()
        .int()
        .min(2024, "Année invalide")
        .max(2100, "Année invalide"),
    period_type: PeriodTypeEnum,
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
    poste_id: z
        .union([z.string().uuid(), z.literal(""), z.literal("none")])
        .optional()
        .transform((v) => (v && v !== "" && v !== "none" ? v : null)),
    price_eur: z.coerce
        .number()
        .min(0, "Prix négatif interdit")
        .max(10000, "Prix trop élevé"),
    paid_amount_eur: z.coerce
        .number()
        .min(0, "Montant négatif interdit")
        .max(10000, "Montant trop élevé"),
    payment_method: PaymentMethodEnum,
    payment_status: PaymentStatusEnum,
    notes: z
        .string()
        .max(2000)
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

const AddSubscriptionSchema = SubscriptionBaseSchema.refine(
    (data) => data.end_date >= data.start_date,
    { message: "Date de fin avant date de début", path: ["end_date"] }
).refine((data) => data.paid_amount_eur <= data.price_eur, {
    message: "Le montant payé dépasse le prix",
    path: ["paid_amount_eur"],
});

const UpdateSubscriptionSchema = SubscriptionBaseSchema.extend({
    id: z.string().uuid(),
})
    .refine((data) => data.end_date >= data.start_date, {
        message: "Date de fin avant date de début",
        path: ["end_date"],
    })
    .refine((data) => data.paid_amount_eur <= data.price_eur, {
        message: "Le montant payé dépasse le prix",
        path: ["paid_amount_eur"],
    });

export async function addPecheurSubscriptionAction(
    formData: FormData
): Promise<ActionResult> {
    const raw = {
        etang_id: formData.get("etang_id"),
        pecheur_full_name: formData.get("pecheur_full_name"),
        pecheur_email: formData.get("pecheur_email") || undefined,
        pecheur_phone: formData.get("pecheur_phone") || undefined,
        saison_year: formData.get("saison_year"),
        period_type: formData.get("period_type"),
        start_date: formData.get("start_date"),
        end_date: formData.get("end_date"),
        poste_id: formData.get("poste_id") || undefined,
        price_eur: formData.get("price_eur"),
        paid_amount_eur: formData.get("paid_amount_eur") ?? "0",
        payment_method: formData.get("payment_method"),
        payment_status: formData.get("payment_status"),
        notes: formData.get("notes") || undefined,
    };

    const parsed = AddSubscriptionSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Vérifie les champs",
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // RLS check — l'utilisateur doit être membre de l'org
    const { data: membership } = await supabase
        .from("memberships")
        .select("role")
        .eq("organization_id", parsed.data.etang_id)
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .single();
    if (!membership) return { ok: false, error: "Accès refusé" };

    // Feature gate : paiement en ligne réservé au plan CRM.
    // Sur plan Vitrine, on bloque uniquement les modes "online_card".
    // Cash/virement/chèque restent autorisés (c'est juste du tracking).
    if (parsed.data.payment_method === "online_card") {
        const gate = await canChargeOnline(parsed.data.etang_id);
        if (!gate.ok) {
            return { ok: false, error: gate.reason };
        }
    }


    // Insert
    const d = parsed.data;
    const { error } = await supabase.from("pecheur_subscriptions").insert({
        etang_id: d.etang_id,
        pecheur_full_name: d.pecheur_full_name,
        pecheur_email: d.pecheur_email,
        pecheur_phone: d.pecheur_phone,
        saison_year: d.saison_year,
        period_type: d.period_type,
        start_date: d.start_date,
        end_date: d.end_date,
        poste_id: d.poste_id,
        price_cents: Math.round(d.price_eur * 100),
        paid_amount_cents: Math.round(d.paid_amount_eur * 100),
        payment_method: d.payment_method,
        payment_status: d.payment_status,
        paid_at: d.payment_status === "paid" ? new Date().toISOString() : null,
        notes: d.notes,
        created_by_user_id: user.id,
    });

    if (error) {
        console.error("addPecheurSubscription failed:", error);
        return { ok: false, error: "Impossible d'enregistrer." };
    }

    revalidatePath("/dashboard/[slug]/registre", "page");
    revalidatePath("/dashboard/[slug]", "page");
    return { ok: true };
}

export async function updatePecheurSubscriptionAction(
    formData: FormData
): Promise<ActionResult> {
    const raw = {
        id: formData.get("id"),
        etang_id: formData.get("etang_id"),
        pecheur_full_name: formData.get("pecheur_full_name"),
        pecheur_email: formData.get("pecheur_email") || undefined,
        pecheur_phone: formData.get("pecheur_phone") || undefined,
        saison_year: formData.get("saison_year"),
        period_type: formData.get("period_type"),
        start_date: formData.get("start_date"),
        end_date: formData.get("end_date"),
        poste_id: formData.get("poste_id") || undefined,
        price_eur: formData.get("price_eur"),
        paid_amount_eur: formData.get("paid_amount_eur") ?? "0",
        payment_method: formData.get("payment_method"),
        payment_status: formData.get("payment_status"),
        notes: formData.get("notes") || undefined,
    };

    const parsed = UpdateSubscriptionSchema.safeParse(raw);
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Vérifie les champs",
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // Feature gate : si on bascule la méthode vers online_card, faut que
    // l'étang soit en plan CRM
    if (parsed.data.payment_method === "online_card") {
        const gate = await canChargeOnline(parsed.data.etang_id);
        if (!gate.ok) {
            return { ok: false, error: gate.reason };
        }
    }

    const d = parsed.data;
    const { error } = await supabase
        .from("pecheur_subscriptions")
        .update({
            pecheur_full_name: d.pecheur_full_name,
            pecheur_email: d.pecheur_email,
            pecheur_phone: d.pecheur_phone,
            saison_year: d.saison_year,
            period_type: d.period_type,
            start_date: d.start_date,
            end_date: d.end_date,
            poste_id: d.poste_id,
            price_cents: Math.round(d.price_eur * 100),
            paid_amount_cents: Math.round(d.paid_amount_eur * 100),
            payment_method: d.payment_method,
            payment_status: d.payment_status,
            paid_at:
                d.payment_status === "paid" ? new Date().toISOString() : null,
            notes: d.notes,
        })
        .eq("id", d.id)
        .eq("etang_id", d.etang_id);

    if (error) {
        console.error("updatePecheurSubscription failed:", error);
        return { ok: false, error: "Impossible de mettre à jour." };
    }

    revalidatePath("/dashboard/[slug]/registre", "page");
    return { ok: true };
}

const DeleteSchema = z.object({
    id: z.string().uuid(),
    etang_id: z.string().uuid(),
});

export async function deletePecheurSubscriptionAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = DeleteSchema.safeParse({
        id: formData.get("id"),
        etang_id: formData.get("etang_id"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase
        .from("pecheur_subscriptions")
        .delete()
        .eq("id", parsed.data.id)
        .eq("etang_id", parsed.data.etang_id);

    if (error) {
        console.error("deletePecheurSubscription failed:", error);
        return { ok: false, error: "Impossible de supprimer." };
    }

    revalidatePath("/dashboard/[slug]/registre", "page");
    return { ok: true };
}

const ExportSchema = z.object({
    etang_id: z.string().uuid(),
    saison_year: z.coerce.number().int().min(2024).max(2100),
});

export async function exportRegistreCsvAction(
    formData: FormData
): Promise<ActionResult<{ filename: string; content: string }>> {
    const parsed = ExportSchema.safeParse({
        etang_id: formData.get("etang_id"),
        saison_year: formData.get("saison_year"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { data: rows, error } = await supabase
        .from("pecheur_subscriptions")
        .select(
            `id, pecheur_full_name, pecheur_email, pecheur_phone,
             saison_year, period_type, start_date, end_date,
             price_cents, paid_amount_cents, payment_method, payment_status,
             paid_at, notes, created_at,
             poste:postes(numero, label)`
        )
        .eq("etang_id", parsed.data.etang_id)
        .eq("saison_year", parsed.data.saison_year)
        .order("pecheur_full_name", { ascending: true });

    if (error) {
        console.error("exportRegistreCsv failed:", error);
        return { ok: false, error: "Erreur lors de l'export." };
    }

    const formatted = (rows ?? []).map((r) => {
        const poste = Array.isArray(r.poste) ? r.poste[0] : r.poste;
        return {
            nom: r.pecheur_full_name,
            email: r.pecheur_email ?? "",
            telephone: r.pecheur_phone ?? "",
            saison: r.saison_year,
            periode: r.period_type,
            debut: r.start_date,
            fin: r.end_date,
            poste: poste?.numero ?? "",
            poste_nom: poste?.label ?? "",
            prix_eur: (r.price_cents / 100).toFixed(2),
            paye_eur: (r.paid_amount_cents / 100).toFixed(2),
            methode: r.payment_method,
            statut: r.payment_status,
            paye_le: r.paid_at ?? "",
            notes: r.notes ?? "",
            cree_le: r.created_at,
        };
    });

    const csv = toCSV(formatted, [
        { key: "nom", label: "Nom" },
        { key: "email", label: "Email" },
        { key: "telephone", label: "Téléphone" },
        { key: "saison", label: "Saison" },
        { key: "periode", label: "Période" },
        { key: "debut", label: "Début" },
        { key: "fin", label: "Fin" },
        { key: "poste", label: "Poste" },
        { key: "poste_nom", label: "Poste (nom)" },
        { key: "prix_eur", label: "Prix (€)" },
        { key: "paye_eur", label: "Payé (€)" },
        { key: "methode", label: "Méthode" },
        { key: "statut", label: "Statut" },
        { key: "paye_le", label: "Payé le" },
        { key: "notes", label: "Notes" },
        { key: "cree_le", label: "Créé le" },
    ]);

    const filename = `sente-registre-${parsed.data.saison_year}.csv`;
    return { ok: true, data: { filename, content: csv } };
}