"use server";

import { createClient } from "@/lib/supabase/server";
import {
    SignupSchema,
    LoginSchema,
    ForgotPasswordSchema,
    ResetPasswordSchema,
} from "@/lib/schemas/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/utils/slug";

export type ActionResult =
    | { ok: true }
    | { ok: false; error: string; fieldErrors?: Record<string, string> };

// =============================================================================
// SIGNUP — pêcheur, étang, magasin
// =============================================================================
export async function signupAction(formData: FormData): Promise<ActionResult> {
    const raw = {
        role: formData.get("role"),
        email: formData.get("email"),
        password: formData.get("password"),
        firstName: formData.get("firstName"),
        lastName: formData.get("lastName"),
        orgName: formData.get("orgName") || undefined,
        orgCountry: formData.get("orgCountry") || undefined,
        consentTos: formData.get("consentTos") === "on",
    };

    const parsed = SignupSchema.safeParse(raw);
    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const path = issue.path[0]?.toString();
            if (path) fieldErrors[path] = issue.message;
        }
        return { ok: false, error: "Vérifie les champs", fieldErrors };
    }

    const supabase = await createClient();
    const { email, password, firstName, lastName, role, orgName, orgCountry } =
        parsed.data;

    // Construit les metadata du futur user.
    // Pour étang/magasin, on injecte les infos d'org DIRECTEMENT dans signUp,
    // car updateUser() après signUp échoue silencieusement quand la session
    // n'est pas encore active (cas confirmation email requise).
    const userMetadata: Record<string, unknown> = {
        full_name: `${firstName} ${lastName}`,
    };

    if (role !== "pecheur" && orgName && orgCountry) {
        userMetadata.pending_org_type = role;
        userMetadata.pending_org_name = orgName.trim();
        userMetadata.pending_org_country = orgCountry;
        userMetadata.pending_org_slug = slugify(orgName);
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: userMetadata,
            emailRedirectTo: `${
                process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
            }/auth/callback`,
        },
    });

    if (signUpError) {
        return { ok: false, error: humanizeAuthError(signUpError.message) };
    }
    if (!signUpData.user) {
        return { ok: false, error: "Erreur inattendue, réessaie." };
    }

    // Pêcheur : terminé
    if (role === "pecheur") return { ok: true };

    // Étang/magasin :
    // - Si Supabase exige confirmation email : session = null, /auth/callback créera l'org
    // - Si pas de confirmation requise : session existe, on crée tout de suite
    if (!signUpData.session) {
        return { ok: true };
    }

    const { error: rpcError } = await supabase.rpc(
        "create_organization_for_owner",
        {
            p_org_type: role,
            p_name: orgName!.trim(),
            p_slug: slugify(orgName!),
            p_country: orgCountry!,
        }
    );

    if (rpcError) {
        console.error("create_organization_for_owner failed:", rpcError);
        return {
            ok: false,
            error: `Compte créé, mais erreur lors de la création de l'organisation : ${humanizeRpcError(
                rpcError.message
            )}. Connecte-toi et réessaie depuis le dashboard.`,
        };
    }

    return { ok: true };
}

// =============================================================================
// LOGIN
// =============================================================================
export async function loginAction(formData: FormData): Promise<ActionResult> {
    const raw = {
        email: formData.get("email"),
        password: formData.get("password"),
    };

    const parsed = LoginSchema.safeParse(raw);
    if (!parsed.success) {
        return { ok: false, error: "Email ou mot de passe invalide" };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
        return { ok: false, error: humanizeAuthError(error.message) };
    }

    revalidatePath("/", "layout");
    redirect("/profil");
}

// =============================================================================
// LOGOUT
// =============================================================================
export async function logoutAction(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/");
}

// =============================================================================
// MOT DE PASSE OUBLIÉ
// =============================================================================
export async function forgotPasswordAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ForgotPasswordSchema.safeParse({
        email: formData.get("email"),
    });

    if (!parsed.success) {
        return { ok: false, error: "Email invalide" };
    }

    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const { error } = await supabase.auth.resetPasswordForEmail(
        parsed.data.email,
        {
            redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
        }
    );

    if (error) {
        // Anti-énumération : on log mais on dit ok au client
        console.error("forgotPassword error (silenced):", error.message);
    }

    return { ok: true };
}

// =============================================================================
// RESET PASSWORD
// =============================================================================
export async function resetPasswordAction(
    formData: FormData
): Promise<ActionResult> {
    const parsed = ResetPasswordSchema.safeParse({
        password: formData.get("password"),
        passwordConfirm: formData.get("passwordConfirm"),
    });

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
    if (!user) {
        return {
            ok: false,
            error: "Lien expiré ou invalide. Demande un nouveau lien.",
        };
    }

    const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
    });

    if (error) {
        return { ok: false, error: humanizeAuthError(error.message) };
    }

    revalidatePath("/", "layout");
    redirect("/profil");
}

// =============================================================================
// HELPERS
// =============================================================================
function humanizeAuthError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("already registered") || lower.includes("user already")) {
        return "Cet email est déjà utilisé. Essaie de te connecter.";
    }
    if (lower.includes("invalid login credentials")) {
        return "Email ou mot de passe incorrect.";
    }
    if (lower.includes("email not confirmed")) {
        return "Confirme ton email avant de te connecter.";
    }
    if (lower.includes("rate limit")) {
        return "Trop de tentatives. Réessaie dans quelques minutes.";
    }
    return "Erreur de connexion. Réessaie ou contacte le support.";
}

function humanizeRpcError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes("slug est déjà utilisé"))
        return "Ce nom est déjà pris, essaie une variante.";
    if (lower.includes("slug invalide"))
        return "Le nom contient des caractères invalides.";
    if (lower.includes("limite de 5"))
        return "Limite atteinte (5 organisations max par compte).";
    return msg;
}