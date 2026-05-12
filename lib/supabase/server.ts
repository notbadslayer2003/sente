import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import {cache} from "react";

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

/**
 * Helper : récupère l'utilisateur authentifié côté serveur.
 *
 * Objectif métier : afficher conditionnellement la navbar
 *                   (avatar/Mon compte vs Se connecter).
 * Garde-fou sécu : `getUser()` (pas `getSession()`) valide le JWT
 *                  auprès de Supabase Auth → on ne fait jamais confiance
 *                  à un cookie non vérifié pour afficher des données sensibles.
 *
 * Cache: 1 seul roundtrip Supabase par requête HTTP, même si la nav,
 * le footer et un Server Component middle appellent tous getServerUser().
 */
export const getServerUser = cache(async () => {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
});