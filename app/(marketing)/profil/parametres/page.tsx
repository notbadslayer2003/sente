import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ParametresPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Mon compte
                </p>
                <h1 className="mt-3 font-display-soft text-5xl tracking-tight">
                    Paramètres
                </h1>
                <p className="mt-6 text-muted-foreground">
                    Édition des paramètres bientôt disponible (changement de mot de
                    passe, suppression de compte, préférences).
                </p>
                <div className="mt-12">
                    <Link
                        href="/profil"
                        className="text-sm uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                    >
                        ← Retour au profil
                    </Link>
                </div>
            </div>
        </section>
    );
}