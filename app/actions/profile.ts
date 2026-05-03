"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {createAdminClient} from "@/lib/supabase/admin";

export type ActionResult =
    | { ok: true }
    | { ok: false; error: string; fieldErrors?: Record<string, string> };

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

const UpdateProfileSchema = z.object({
    full_name: z
        .string()
        .min(2, "Nom trop court")
        .max(100, "Nom trop long"),
    phone: z
        .string()
        .max(50, "Numéro trop long")
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
    bio: z
        .string()
        .max(500, "Bio trop longue (500 caractères max)")
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
    city: z
        .string()
        .max(100)
        .optional()
        .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
    country: z
        .union([z.enum(["BE", "FR"]), z.literal("")])
        .optional()
        .transform((v) => (v === "" || v === undefined ? null : v)),
    especes_pref: z.array(EspeceEnum).max(20),
    marketing_opt_in: z.preprocess(
        (v) => v === "on" || v === true,
        z.boolean()
    ),
});

export async function updateProfileAction(
    formData: FormData
): Promise<ActionResult> {
    const especes_pref = formData.getAll("especes_pref").map(String);

    const raw = {
        full_name: formData.get("full_name"),
        phone: formData.get("phone") || undefined,
        bio: formData.get("bio") || undefined,
        city: formData.get("city") || undefined,
        country: formData.get("country") || "",
        especes_pref,
        marketing_opt_in: formData.get("marketing_opt_in"),
    };

    const parsed = UpdateProfileSchema.safeParse(raw);
    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const path = issue.path[0]?.toString();
            if (path) fieldErrors[path] = issue.message;
        }
        return { ok: false, error: "Vérifie les champs", fieldErrors };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // Construit l'objet de mise à jour avec un type accepté par Supabase JS.
    // marketing_opt_in_at n'est mis à jour que si l'opt-in est activé.
    const { error } = parsed.data.marketing_opt_in
        ? await supabase
            .from("profiles")
            .update({
                full_name: parsed.data.full_name,
                phone: parsed.data.phone,
                bio: parsed.data.bio,
                city: parsed.data.city,
                country: parsed.data.country,
                especes_pref: parsed.data.especes_pref,
                marketing_opt_in: true,
                marketing_opt_in_at: new Date().toISOString(),
            })
            .eq("id", user.id)
        : await supabase
            .from("profiles")
            .update({
                full_name: parsed.data.full_name,
                phone: parsed.data.phone,
                bio: parsed.data.bio,
                city: parsed.data.city,
                country: parsed.data.country,
                especes_pref: parsed.data.especes_pref,
                marketing_opt_in: false,
            })
            .eq("id", user.id);

    if (error) {
        console.error("updateProfile failed:", error);
        return { ok: false, error: "Impossible de sauvegarder." };
    }

    revalidatePath("/profil");
    revalidatePath("/profil/parametres");
    return { ok: true };
}

/**
 * Soft-delete du compte. Le profile est marqué supprimé, l'utilisateur
 * est déconnecté. Une edge function cron à 30j purge définitivement.
 *
 * Note : on ne supprime pas auth.users immédiatement pour permettre la
 * récupération du compte si l'utilisateur change d'avis dans les 30 jours.
 */
const DeleteAccountSchema = z.object({
    confirmation: z.literal("SUPPRIMER", {
        message: "Tape SUPPRIMER pour confirmer",
    }),
});

export async function deleteMyAccountAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = DeleteAccountSchema.safeParse({
        confirmation: formData.get("confirmation"),
    });
    if (!parsed.success) {
        return {
            ok: false,
            error: "Tape SUPPRIMER (en majuscules) pour confirmer",
        };
    }

    // 1. Identifier l'utilisateur via le client RLS (auth)
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Non authentifié" };

    // 2. Bloque si owner d'orgs actives (lecture via le client user, RLS OK)
    const { data: ownedActive } = await supabase
        .from("organizations")
        .select("id, name, slug, status")
        .eq("owner_user_id", user.id)
        .is("deleted_at", null)
        .neq("status", "draft");

    if (ownedActive && ownedActive.length > 0) {
        const names = ownedActive.map((o) => o.name).join(", ");
        return {
            ok: false,
            error: `Impossible : tu es owner de l'organisation ${names}. Transfère la propriété ou ferme l'organisation avant de supprimer ton compte.`,
        };
    }

    // 3. Soft delete + audit log via service_role (bypass RLS)
    //    On a déjà vérifié l'identité ci-dessus, c'est sûr.
    const admin = createAdminClient();

    const { error: profileError } = await admin
        .from("profiles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", user.id);

    if (profileError) {
        console.error("deleteMyAccount profile failed:", profileError);
        return { ok: false, error: "Erreur lors de la suppression." };
    }

    await admin.from("audit_log").insert({
        actor_user_id: user.id,
        action: "user.soft_delete",
        target_type: "profile",
        target_id: user.id,
        payload: { reason: "user_request" },
    });

    // 4. Logout côté user
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/?account_deleted=1");
}