"use server";

import {createClient} from "@/lib/supabase/server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {z} from "zod";
import {createAdminClient} from "@/lib/supabase/admin";
import { ESPECE_VALUES } from "@/lib/constants/especes";
import {isValidPhone} from "@/lib/utils/phone";
import {syncMarketingOptIn} from "@/lib/email/audience";

export type ActionResult =
    | { ok: true }
    | { ok: false; error: string; fieldErrors?: Record<string, string> };

const EspeceEnum = z.enum(ESPECE_VALUES);

const UpdateProfileSchema = z.object({
    full_name: z
        .string()
        .min(2, "Nom trop court")
        .max(100, "Nom trop long"),
    phone: z
        .string()
        .optional()
        .transform((v) => (v && v.trim() ? v.trim() : null))
        .refine((v) => !v || isValidPhone(v), {
            message: "Numéro de téléphone invalide.",
        }),
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
    if (!user?.email) return { ok: false, error: "Non authentifié" };

    // Lire l'ancien marketing_opt_in pour détecter un changement
    // (évite de spammer Resend à chaque save de profil)
    const { data: oldProfile } = await supabase
        .from("profiles")
        .select("marketing_opt_in")
        .eq("id", user.id)
        .single();
    const oldOptIn = oldProfile?.marketing_opt_in ?? false;
    const newOptIn = parsed.data.marketing_opt_in;

    // marketing_opt_in_at est posé uniquement à la bascule false → true,
    // pour conserver la date du consentement RGPD initial (ou du dernier
    // re-consentement après désinscription). Pas reset à chaque save.
    const update = {
        full_name: parsed.data.full_name,
        phone: parsed.data.phone,
        bio: parsed.data.bio,
        city: parsed.data.city,
        country: parsed.data.country,
        especes_pref: parsed.data.especes_pref,
        marketing_opt_in: newOptIn,
        ...(newOptIn && !oldOptIn
            ? { marketing_opt_in_at: new Date().toISOString() }
            : {}),
    };

    const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", user.id);

    if (error) {
        console.error("updateProfile failed:", error);
        return { ok: false, error: "Impossible de sauvegarder." };
    }

    // Sync full_name dans auth.users.raw_user_meta_data pour lecture gratuite
    // dans le JWT (navbar, breadcrumbs). Évite une query profiles à chaque page.
    //
    // Garde-fou : auth.updateUser({ data }) fait un MERGE des metadata, donc
    // on ne casse PAS les autres clés (pending_org_*, etc.).
    //
    // Best-effort : si ça échoue, on continue. Le profile est sauvé, la nav
    // fallback sur user.email. Pas la peine de bloquer l'UX pour un sync raté.
    const { error: metaError } = await supabase.auth.updateUser({
        data: { full_name: parsed.data.full_name },
    });

    if (metaError) {
        console.error("updateProfile metadata sync failed:", metaError);
        // On ne return pas en erreur : profil sauvé, nav fallback gérée.
    }

    // Sync audience Resend uniquement si l'opt-in a changé d'état.
    // Best-effort : le helper catch ses erreurs en interne, un fail
    // côté Resend ne fait pas échouer l'enregistrement du profil.
    if (oldOptIn !== newOptIn) {
        const fullName = parsed.data.full_name?.trim() ?? "";
        const [firstName, ...rest] = fullName.split(" ");
        await syncMarketingOptIn({
            email: user.email,
            optIn: newOptIn,
            firstName: firstName || null,
            lastName: rest.join(" ") || null,
        });
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
        data: {user},
    } = await supabase.auth.getUser();
    if (!user) return {ok: false, error: "Non authentifié"};

    // 2. Bloque si owner d'orgs actives (lecture via le client user, RLS OK)
    const {data: ownedActive} = await supabase
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

    const {error: profileError} = await admin
        .from("profiles")
        .update({deleted_at: new Date().toISOString()})
        .eq("id", user.id);

    if (profileError) {
        console.error("deleteMyAccount profile failed:", profileError);
        return {ok: false, error: "Erreur lors de la suppression."};
    }

    await admin.from("audit_log").insert({
        actor_user_id: user.id,
        action: "user.soft_delete",
        target_type: "profile",
        target_id: user.id,
        payload: {reason: "user_request"},
    });

    // 4. Logout côté user
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/?account_deleted=1");
}

export async function exportUserDataAction(): Promise<
    { ok: true; data: string } | { ok: false; error: string }
> {
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {ok: false, error: "Non authentifié."};

    const admin = createAdminClient();

    const [profile, memberships, posts, orders, eventRegs, pecheurSubs, consents] =
        await Promise.all([
            admin.from("profiles").select("*").eq("id", user.id).single().then((r) => r.data),
            admin
                .from("memberships")
                .select("role, accepted_at, organization:organizations(name, org_type)")
                .eq("user_id", user.id)
                .then((r) => r.data ?? []),
            admin
                .from("posts")
                .select("id, content, photos, status, espece, weight_kg, created_at, updated_at, deleted_at")
                .eq("author_user_id", user.id)
                .then((r) => r.data ?? []),
            admin
                .from("orders")
                .select("id, status, total_cents, subtotal_cents, shipping_cents, created_at, paid_at")
                .eq("buyer_user_id", user.id)
                .then((r) => r.data ?? []),
            admin
                .from("event_registrations")
                .select("id, event_id, full_name, email, payment_status, paid_amount_cents, created_at")
                .eq("user_id", user.id)
                .then((r) => r.data ?? []),
            admin
                .from("pecheur_subscriptions")
                .select("id, etang_id, saison_year, period_type, start_date, end_date, payment_status, paid_amount_cents, created_at")
                .eq("pecheur_user_id", user.id)
                .then((r) => r.data ?? []),
            admin
                .from("consent_log")
                .select("kind, version, granted, ip, created_at")
                .eq("user_id", user.id)
                .order("created_at", {ascending: true})
                .then((r) => r.data ?? []),
        ]);

    const payload = {
        exported_at: new Date().toISOString(),
        account: {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
        },
        profile,
        memberships,
        posts,
        orders,
        event_registrations: eventRegs,
        pecheur_subscriptions: pecheurSubs,
        consents,
    };

    return {ok: true, data: JSON.stringify(payload, null, 2)};
}