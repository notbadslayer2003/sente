import { notFound } from "next/navigation";
import { getDashboardContext } from "@/lib/dal/dashboard";
import { getEventDetail } from "@/lib/dal/events";
import { EventForm } from "@/components/sente/event-form";

type Params = Promise<{ slug: string; id: string }>;

export default async function EditEventPage({ params }: { params: Params }) {
    const { slug, id } = await params;
    const ctx = await getDashboardContext(slug);
    const event = await getEventDetail(id);

    if (!event || event.organization.id !== ctx.org.id) notFound();
    if (event.status === "cancelled") notFound();

    return (
        <div className="space-y-10 max-w-2xl">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Édition
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    {event.title}
                </h1>
            </div>

            <EventForm
                organizationId={ctx.org.id}
                dashboardSlug={slug}
                mode="edit"
                event={event}
            />
        </div>
    );
}