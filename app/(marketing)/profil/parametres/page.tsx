import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProfileSettingsForm } from "@/components/sente/profile-settings-form";
import { DeleteAccountSection } from "@/components/sente/delete-account-section";
import {ExportDataSection} from "@/components/sente/export-data-section";

export default async function ParametresPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select(
            "full_name, phone, bio, city, country, especes_pref, marketing_opt_in"
        )
        .eq("id", user.id)
        .single();

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12 space-y-12">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Mon compte
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl tracking-tight">
                        Paramètres
                    </h1>
                </div>

                <ProfileSettingsForm
                    profile={{
                        full_name: profile?.full_name ?? "",
                        phone: profile?.phone ?? "",
                        bio: profile?.bio ?? "",
                        city: profile?.city ?? "",
                        country: profile?.country ?? "",
                        especes_pref: profile?.especes_pref ?? [],
                        marketing_opt_in: profile?.marketing_opt_in ?? false,
                    }}
                />

                <ExportDataSection />
                <DeleteAccountSection email={user.email ?? ""} />

                <Link
                    href="/profil"
                    className="inline-block text-sm uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                >
                    ← Retour au profil
                </Link>
            </div>
        </section>
    );
}