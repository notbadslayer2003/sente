import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import { FicheForm } from "@/components/sente/fiche-form";
import { EtangDetailsForm } from "@/components/sente/etang-details-form";
import { MagasinDetailsForm } from "@/components/sente/magasin-details-form";

type Params = Promise<{ slug: string }>;

type ReglementDb = {
    no_kill?: boolean;
    baitboat_autorise?: boolean;
    nuit_autorisee?: boolean;
    nb_cannes_max?: number | null;
    permis_requis?: boolean;
};

export default async function FichePage({ params }: { params: Params }) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    const supabase = await createClient();

    const { data: org } = await supabase
        .from("organizations")
        .select(
            "id, name, baseline, description, country, region, city, postal_code, address, lat, lng, contact_email, contact_phone, website, social_facebook, social_instagram"
        )
        .eq("id", ctx.org.id)
        .single();

    if (!org) return null;

    // Charge les détails métier selon le type d'org
    let etangDetails = null;
    let magasinDetails = null;

    if (ctx.org.org_type === "etang") {
        const { data } = await supabase
            .from("etang_details")
            .select(
                "especes, superficie_ha, profondeur_max_m, record_kg, tarif_journee_cents, tarif_annee_cents, reservation_active, reglement"
            )
            .eq("organization_id", ctx.org.id)
            .single();
        etangDetails = data;
    } else {
        const { data } = await supabase
            .from("magasin_details")
            .select("specialites, marques, horaires")
            .eq("organization_id", ctx.org.id)
            .single();
        magasinDetails = data;
    }

    const reglement = (etangDetails?.reglement ?? null) as ReglementDb | null;

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Édition
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Fiche publique
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Ces informations apparaîtront sur ta fiche publique Sente.
                    Les sections sont enregistrées séparément.
                </p>
            </div>

            <section>
                <h2 className="font-display text-2xl tracking-tight mb-2">
                    Informations générales
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
                    Présentation, localisation, contact et réseaux sociaux.
                </p>
                <FicheForm
                    org={{
                        id: org.id,
                        name: org.name,
                        baseline: org.baseline ?? "",
                        description: org.description ?? "",
                        country: org.country,
                        region: org.region ?? "",
                        city: org.city ?? "",
                        postal_code: org.postal_code ?? "",
                        address: org.address ?? "",
                        lat: org.lat?.toString() ?? "",
                        lng: org.lng?.toString() ?? "",
                        contact_email: org.contact_email ?? "",
                        contact_phone: org.contact_phone ?? "",
                        website: org.website ?? "",
                        social_facebook: org.social_facebook ?? "",
                        social_instagram: org.social_instagram ?? "",
                    }}
                />
            </section>

            <section className="border-t border-border pt-12">
                <h2 className="font-display text-2xl tracking-tight mb-2">
                    {ctx.org.org_type === "etang"
                        ? "Détails de l'étang"
                        : "Détails du magasin"}
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
                    {ctx.org.org_type === "etang"
                        ? "Espèces, superficie, tarifs indicatifs."
                        : "Spécialités, marques distribuées, horaires."}
                </p>

                {ctx.org.org_type === "etang" && (
                    <EtangDetailsForm
                        details={{
                            org_id: org.id,
                            especes: etangDetails?.especes ?? [],
                            superficie_ha:
                                etangDetails?.superficie_ha?.toString() ?? "",
                            profondeur_max_m:
                                etangDetails?.profondeur_max_m?.toString() ?? "",
                            record_kg: etangDetails?.record_kg?.toString() ?? "",
                            tarif_journee_eur: etangDetails?.tarif_journee_cents
                                ? (etangDetails.tarif_journee_cents / 100).toFixed(2)
                                : "",
                            tarif_annee_eur: etangDetails?.tarif_annee_cents
                                ? (etangDetails.tarif_annee_cents / 100).toFixed(2)
                                : "",
                            reservation_active: etangDetails?.reservation_active ?? false,
                            reglement: {
                                no_kill: reglement?.no_kill ?? false,
                                baitboat_autorise: reglement?.baitboat_autorise ?? false,
                                nuit_autorisee: reglement?.nuit_autorisee ?? false,
                                nb_cannes_max: reglement?.nb_cannes_max?.toString() ?? "",
                                permis_requis: reglement?.permis_requis ?? true, // default true (cas le plus courant)
                            },
                        }}
                    />
                )}

                {ctx.org.org_type === "magasin" && (
                    <MagasinDetailsForm
                        details={{
                            org_id: org.id,
                            specialites: magasinDetails?.specialites ?? [],
                            marques: magasinDetails?.marques ?? [],
                            horaires_texte:
                                (magasinDetails?.horaires as { texte?: string } | null)
                                    ?.texte ?? "",
                        }}
                    />
                )}
            </section>
        </div>
    );
}