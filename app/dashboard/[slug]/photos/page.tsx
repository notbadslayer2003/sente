import { getDashboardContext } from "@/lib/dal/dashboard";
import { createClient } from "@/lib/supabase/server";
import {
    CoverUploader,
    GalleryUploader,
} from "@/components/sente/photo-uploader";

type Params = Promise<{ slug: string }>;

export default async function PhotosPage({ params }: { params: Params }) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    const supabase = await createClient();
    const { data: org } = await supabase
        .from("organizations")
        .select("id, cover_image_url, photos")
        .eq("id", ctx.org.id)
        .single();
    if (!org) return null;

    return (
        <div className="space-y-12">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Photos
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Médias de la fiche
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Une photo de couverture en 16:9 + jusqu&apos;à 15 photos de galerie.
                    Compressées automatiquement avant envoi.
                </p>
            </div>

            <section className="space-y-5">
                <div>
                    <h2 className="font-display text-xl tracking-tight">Photo de couverture</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Apparaît en haut de la fiche publique.
                    </p>
                </div>
                <CoverUploader orgId={org.id} currentUrl={org.cover_image_url} />
            </section>

            <section className="space-y-5 border-t border-border pt-12">
                <div>
                    <h2 className="font-display text-xl tracking-tight">Galerie</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Photos secondaires affichées sur la fiche.
                    </p>
                </div>
                <GalleryUploader orgId={org.id} currentPhotos={org.photos ?? []} />
            </section>
        </div>
    );
}