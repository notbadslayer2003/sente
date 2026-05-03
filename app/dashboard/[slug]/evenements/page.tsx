import Link from "next/link";
import { Plus } from "lucide-react";
import { getDashboardContext } from "@/lib/dal/dashboard";
import { getEventsByOrg } from "@/lib/dal/events";
import { EventManagerCard } from "@/components/sente/event-manager-card";

type Params = Promise<{ slug: string }>;

export default async function DashboardEventsPage({
                                                      params,
                                                  }: {
    params: Params;
}) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    const events = await getEventsByOrg({ orgId: ctx.org.id, includeAll: true });

    const drafts = events.filter((e) => e.status === "draft");
    const upcoming = events.filter(
        (e) => e.status === "published" && new Date(e.starts_at) >= new Date()
    );
    const cancelled = events.filter((e) => e.status === "cancelled");
    const past = events.filter(
        (e) =>
            (e.status === "published" || e.status === "completed") &&
            new Date(e.starts_at) < new Date()
    );

    return (
        <div className="space-y-12">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Communauté
                    </p>
                    <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                        Événements
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground max-w-xl">
                        Crée des concours, journées découvertes ou stages. Les pêcheurs
                        s&apos;inscrivent en ligne, paient si nécessaire, et tu gères tes
                        inscrits depuis ton dashboard.
                    </p>
                </div>
                <Link
                    href={`/dashboard/${slug}/evenements/nouveau`}
                    className="inline-flex items-center gap-2 bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium"
                >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                    Nouvel événement
                </Link>
            </div>

            <Section title="Brouillons" emptyText="Aucun brouillon." events={drafts} slug={slug} />
            <Section title="À venir" emptyText="Aucun événement à venir." events={upcoming} slug={slug} />
            <Section title="Annulés" emptyText="Aucun événement annulé." events={cancelled} slug={slug} />
            <Section title="Passés" emptyText="Aucun événement passé." events={past} slug={slug} />
        </div>
    );
}

function Section({
                     title,
                     emptyText,
                     events,
                     slug,
                 }: {
    title: string;
    emptyText: string;
    events: Awaited<ReturnType<typeof getEventsByOrg>>;
    slug: string;
}) {
    return (
        <div>
            <h2 className="font-display text-xl tracking-tight mb-4">{title}</h2>
            {events.length === 0 ? (
                <div className="border border-dashed border-border p-8 text-center">
                    <p className="text-xs text-muted-foreground">{emptyText}</p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {events.map((e) => (
                        <li key={e.id}>
                            <EventManagerCard event={e} dashboardSlug={slug} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}