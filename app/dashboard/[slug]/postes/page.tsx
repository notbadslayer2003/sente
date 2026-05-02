import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PostesManager } from "@/components/sente/postes-manager";

type Params = Promise<{ slug: string }>;

export default async function PostesPage({ params }: { params: Params }) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    if (ctx.org.org_type !== "etang") redirect(`/dashboard/${slug}`);

    const supabase = await createClient();

    const [{ data: details }, { data: postes }] = await Promise.all([
        supabase
            .from("etang_details")
            .select("postes_attribues_actifs, postes_count")
            .eq("organization_id", ctx.org.id)
            .single(),
        supabase
            .from("postes")
            .select("id, numero, label, description, active")
            .eq("etang_id", ctx.org.id)
            .order("numero", { ascending: true }),
    ]);

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Configuration
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Postes
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Si tu attribues des postes à tes pêcheurs, configure-les ici. Sinon,
                    tu peux désactiver complètement la fonctionnalité — elle disparaîtra
                    de ta fiche publique et du registre.
                </p>
            </div>

            <PostesManager
                orgId={ctx.org.id}
                attribuesActifs={details?.postes_attribues_actifs ?? false}
                postesCount={details?.postes_count ?? 0}
                postes={postes ?? []}
            />
        </div>
    );
}