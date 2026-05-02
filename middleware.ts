import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

const PROTECTED_PREFIXES = ["/profil", "/dashboard", "/admin", "/onboarding"];

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh la session
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Si user connecté, vérifie le soft-delete uniquement sur les routes protégées
    // (pour éviter une query DB sur les pages publiques)
    if (user) {
        const path = request.nextUrl.pathname;
        const isProtected = PROTECTED_PREFIXES.some((prefix) =>
            path.startsWith(prefix)
        );

        if (isProtected) {
            // service_role pour bypass la RLS qui cache deleted_at IS NOT NULL
            const admin = createSupabaseClient<Database>(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { autoRefreshToken: false, persistSession: false } }
            );

            const { data: profile } = await admin
                .from("profiles")
                .select("deleted_at")
                .eq("id", user.id)
                .single();

            if (profile?.deleted_at) {
                await supabase.auth.signOut();
                const url = request.nextUrl.clone();
                url.pathname = "/";
                url.search = "?account_deleted=1";
                return NextResponse.redirect(url);
            }
        }
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};