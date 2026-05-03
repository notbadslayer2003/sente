"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const ReasonEnum = z.enum([
    "spam",
    "harassment",
    "inappropriate",
    "misinfo",
    "other",
]);

const CreateReportSchema = z.object({
    target_type: z.enum(["post", "comment"]),
    target_id: z.string().uuid(),
    reason: ReasonEnum,
    detail: z
        .string()
        .max(1000, "Maximum 1000 caractères")
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
});

export async function createReportAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = CreateReportSchema.safeParse({
        target_type: formData.get("target_type"),
        target_id: formData.get("target_id"),
        reason: formData.get("reason"),
        detail: formData.get("detail"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: parsed.error.issues[0]?.message ?? "Champs invalides",
        };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("create_report", {
        p_target_type: parsed.data.target_type,
        p_target_id: parsed.data.target_id,
        p_reason_code: parsed.data.reason,
        p_detail: parsed.data.detail,
    });

    if (error) {
        console.error("create_report failed:", error);
        if (error.code === "23505") {
            return { ok: false, error: "Tu as déjà signalé ce contenu." };
        }
        return { ok: false, error: "Erreur lors du signalement." };
    }

    return { ok: true };
}

const ReportActionSchema = z.object({
    report_id: z.string().uuid(),
    note: z.string().max(1000).optional().nullable(),
});

export async function dismissReportAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ReportActionSchema.safeParse({
        report_id: formData.get("report_id"),
        note: formData.get("note"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("dismiss_report", {
        p_report_id: parsed.data.report_id,
        p_note: parsed.data.note ?? null,
    });
    if (error) return { ok: false, error: "Action refusée." };

    revalidatePath("/admin/reports");
    return { ok: true };
}

export async function hideReportPostAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ReportActionSchema.safeParse({
        report_id: formData.get("report_id"),
        note: formData.get("note"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("action_report_hide_post", {
        p_report_id: parsed.data.report_id,
        p_note: parsed.data.note ?? null,
    });
    if (error) return { ok: false, error: "Action refusée." };

    revalidatePath("/admin/reports");
    revalidatePath("/feed");
    return { ok: true };
}

export async function hideReportCommentAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ReportActionSchema.safeParse({
        report_id: formData.get("report_id"),
        note: formData.get("note"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("action_report_hide_comment", {
        p_report_id: parsed.data.report_id,
        p_note: parsed.data.note ?? null,
    });
    if (error) return { ok: false, error: "Action refusée." };

    revalidatePath("/admin/reports");
    return { ok: true };
}

export async function banReportUserAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ReportActionSchema.safeParse({
        report_id: formData.get("report_id"),
        note: formData.get("note"),
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("action_report_ban_user", {
        p_report_id: parsed.data.report_id,
        p_note: parsed.data.note ?? null,
    });
    if (error) return { ok: false, error: "Action refusée." };

    revalidatePath("/admin/reports");
    return { ok: true };
}