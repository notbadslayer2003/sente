import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfilSidebar } from "@/components/sente/profil-sidebar";

// =============================================================================
// Layout : (marketing)/profil/*
// =============================================================================
// Espace user perso (B2C consumer). Sidebar avec deux groupes : Mon profil
// (général) et Marketplace (C2C). Auth requise — redirect /login si absent.
// =============================================================================

export default async function ProfilLayout({
                                               children,
                                           }: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // On fetche le profile pour afficher nom + email dans la sidebar.
    // Si pas de profile (cas rare : user créé sans trigger), on tombe sur l'email.
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

    return (
        <div className="bg-background min-h-screen pt-16">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-8 lg:py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    <aside className="lg:col-span-3">
                        <ProfilSidebar
                            userEmail={user.email ?? ""}
                            fullName={profile?.full_name ?? null}
                        />
                    </aside>
                    <main className="lg:col-span-9 space-y-6">{children}</main>
                </div>
            </div>
        </div>
    );
}