import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import { FicheForm } from "@/components/sente/fiche-form";

type Params = Promise<{ slug: string }>;

export default async function FichePage({ params }: { params: Params }) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    const supabase = await createClient();

    const { data: org } = await supabase
        .from("organizations")
        .select(
            "id, name, baseline, description, region, city, postal_code, address, lat, lng, contact_email, contact_phone, website, social_facebook, social_instagram"
        )
        .eq("id", ctx.org.id)
        .single();

    if (!org) return null;

    return (
        <div className="space-y-8">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Édition
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Fiche publique
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Ces informations apparaîtront sur ta fiche publique Sente.
                    Sauvegarde à chaque section, tu peux y revenir à tout moment.
                </p>
            </div>

            <FicheForm
                org={{
                    id: org.id,
                    name: org.name,
                    baseline: org.baseline ?? "",
                    description: org.description ?? "",
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
        </div>
    );
}