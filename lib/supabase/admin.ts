import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase admin (service_role) — BYPASS RLS.
 *
 * ⚠️ DANGER : à n'utiliser QUE :
 * - dans des route handlers / server actions explicitement audités
 * - jamais dans un Client Component
 * - jamais avec un input user non validé
 *
 * Cas d'usage légitimes :
 * - webhooks Stripe (signature vérifiée AVANT)
 * - tâches cron (purge soft-deleted, audit export)
 * - opérations admin Sente après vérification is_app_admin
 */
export function createAdminClient() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
    }

    return createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}