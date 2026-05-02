import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/profil";

    if (!code) {
        return NextResponse.redirect(`${origin}/auth/error`);
    }

    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
        code
    );

    if (exchangeError) {
        console.error("[/auth/callback] exchangeCodeForSession failed:", exchangeError);
        return NextResponse.redirect(`${origin}/auth/error`);
    }

    // Récupère le user (après échange)
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        console.error("[/auth/callback] no user after exchange");
        return NextResponse.redirect(`${origin}/auth/error`);
    }

    const meta = user.user_metadata ?? {};

    const hasPendingOrg =
        meta.pending_org_type &&
        meta.pending_org_name &&
        meta.pending_org_country &&
        meta.pending_org_slug;

    if (hasPendingOrg) {

        const { data: rpcData, error: rpcError } = await supabase
            .rpc("create_organization_for_owner", {
                p_org_type: meta.pending_org_type,
                p_name: meta.pending_org_name,
                p_slug: meta.pending_org_slug,
                p_country: meta.pending_org_country,
            })
            .single();

        if (rpcError) {
            console.error("[/auth/callback] RPC failed:", rpcError);
            // On laisse le user atterrir sur /profil avec une notice qu'il pourra
            // recréer son org. Mais on ne le bloque pas.
            return NextResponse.redirect(
                `${origin}/profil?org_creation_failed=1`
            );
        }

        if (rpcData) {

            // Nettoyer les metadata
            await supabase.auth.updateUser({
                data: {
                    pending_org_type: null,
                    pending_org_name: null,
                    pending_org_country: null,
                    pending_org_slug: null,
                },
            });

            return NextResponse.redirect(
                `${origin}/onboarding/${rpcData.organization_slug}`
            );
        }
    }

    return NextResponse.redirect(`${origin}${next}`);
}