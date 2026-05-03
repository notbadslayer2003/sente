import { getDashboardContext } from "@/lib/dal/dashboard";
import { EventForm } from "@/components/sente/event-form";

type Params = Promise<{ slug: string }>;

export default async function NewEventPage({ params }: { params: Params }) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    return (
        <div className="space-y-10 max-w-2xl">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Communauté
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Nouvel événement
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    Tu peux enregistrer en brouillon pour finaliser plus tard, ou publier directement.
                </p>
            </div>

            <EventForm
                organizationId={ctx.org.id}
                dashboardSlug={slug}
                mode="create"
            />
        </div>
    );
}