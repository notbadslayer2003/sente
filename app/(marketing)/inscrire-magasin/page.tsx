
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrgSignupForm } from "@/components/sente/org-signup-form";
import { getOrganizationCountForCurrentUser } from "@/app/actions/organizations";

const ORG_LIMIT = 5;

export const metadata = {
    title: "Inscrire un magasin — Sente",
    description:
        "Référence ton magasin pêche sur Sente : visibilité gratuite, communauté, et boutique en ligne intégrée.",
};

export default async function InscrireMagasinPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        redirect("/login?next=/inscrire-magasin");
    }

    const orgCount = await getOrganizationCountForCurrentUser();
    if (orgCount >= ORG_LIMIT) {
        redirect("/profil?org_limit=1");
    }

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-2xl px-6 sm:px-8 lg:px-12">
                <div className="text-center mb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Inscrire un magasin
                    </p>
                    <h1 className="mt-3 font-display-soft text-4xl sm:text-5xl tracking-tight leading-[0.95]">
                        Référence ton magasin sur Sente.
                    </h1>
                    <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
                        Visibilité gratuite dans la communauté pêche, et une boutique
                        en ligne intégrée à partir de 0 €/mois (commission 5%).
                    </p>
                </div>

                <OrgSignupForm type="magasin" />

                <p className="mt-10 text-center text-sm text-muted-foreground">
                    Tu cherches plutôt à inscrire un étang ?{" "}
                    <Link
                        href="/inscrire-etang"
                        className="text-foreground border-b border-foreground hover:text-accent hover:border-accent transition-colors uppercase tracking-wide text-xs ml-1"
                    >
                        Par ici
                    </Link>
                </p>
            </div>
        </section>
    );
}