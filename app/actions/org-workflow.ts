"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = undefined> =
    | { ok: true; data?: T }
    | { ok: false; error: string };

const SubmitSchema = z.object({ org_id: z.string().uuid() });

export async function submitOrgForReviewAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = SubmitSchema.safeParse({ org_id: formData.get("org_id") });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_organization_for_review", {
        p_org_id: parsed.data.org_id,
    });

    if (error) {
        console.error("submitOrgForReview failed:", error);
        return { ok: false, error: humanizeWorkflowError(error.message) };
    }

    revalidatePath("/dashboard/[slug]", "page");
    revalidatePath("/profil", "page");
    return { ok: true };
}

const ApproveSchema = z.object({
    org_id: z.string().uuid(),
    note: z.string().optional(),
});

export async function approveOrgAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ApproveSchema.safeParse({
        org_id: formData.get("org_id"),
        note: formData.get("note") || undefined,
    });
    if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("approve_organization", {
        p_org_id: parsed.data.org_id,
        p_note: parsed.data.note ?? undefined,
    });

    if (error) {
        console.error("approveOrg failed:", error);
        return { ok: false, error: error.message };
    }

    revalidatePath("/admin/organizations");
    revalidatePath("/lieux");
    revalidatePath("/magasins");
    return { ok: true };
}

const RejectSchema = z.object({
    org_id: z.string().uuid(),
    reason: z.string().min(10),
});

export async function rejectOrgAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = RejectSchema.safeParse({
        org_id: formData.get("org_id"),
        reason: formData.get("reason"),
    });
    if (!parsed.success) return { ok: false, error: "Raison requise (10 caractères min)" };

    const supabase = await createClient();
    const { error } = await supabase.rpc("reject_organization", {
        p_org_id: parsed.data.org_id,
        p_reason: parsed.data.reason,
    });

    if (error) {
        console.error("rejectOrg failed:", error);
        return { ok: false, error: error.message };
    }

    revalidatePath("/admin/organizations");
    return { ok: true };
}

function humanizeWorkflowError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("description trop courte"))
        return "Description trop courte (50 caractères minimum).";
    if (lower.includes("adresse manquante")) return "Adresse manquante.";
    if (lower.includes("email ou téléphone"))
        return "Au moins un email ou téléphone de contact requis.";
    if (lower.includes("brouillon"))
        return "L'organisation a déjà été soumise ou validée.";
    return msg;
}