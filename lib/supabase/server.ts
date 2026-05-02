import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

/**
 * Client Supabase pour le serveur Next.js (RSC, Server Actions, route handlers).
 * Lit/écrit les cookies via next/headers pour synchroniser la session avec le client.
 * Utilise la clé anon publique. Toutes les requêtes passent par RLS de l'utilisateur.
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // setAll appelé depuis un Server Component : ignoré.
                        // La session est rafraîchie par le middleware côté requête suivante.
                    }
                },
            },
        }
    );
}