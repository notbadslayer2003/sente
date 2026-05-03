import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEventDetail } from "@/lib/dal/events";
import { EventRegistrationForm } from "@/components/sente/event-registration-form";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ cancelled?: string }>;

export default async function EventRegistrationPage({
                                                        params,
                                                        searchParams,
                                                    }: {
    params: Params;
    searchParams: SearchParams;
}) {
    const { id } = await params;
    const sp = await searchParams;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/login?next=/evenements/${id}/inscription`);

    const event = await getEventDetail(id);
    if (!event) notFound();

    if (event.status !== "published") redirect(`/evenements/${id}`);
    if (new Date(event.starts_at) < new Date()) redirect(`/evenements/${id}`);
    if (event.is_registered_by_me) redirect(`/evenements/${id}`);

    const placesLeft = event.max_participants
        ? Math.max(0, event.max_participants - event.registrations_count)
        : null;
    if (placesLeft === 0) redirect(`/evenements/${id}`);

    // Profile pour pré-remplir le nom
    const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();

    return (
        <section className="bg-background min-h-screen pt-24 pb-20">
            <div className="mx-auto max-w-2xl px-6 sm:px-8">
                <div className="mb-10">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Inscription
                    </p>
                    <h1 className="mt-3 font-display-soft text-4xl tracking-tight leading-[1.05]">
                        {event.title}
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Par {event.organization.name} · {formatDate(event.starts_at)}
                    </p>
                </div>

                {sp.cancelled === "1" && (
                    <div className="border border-destructive/30 bg-destructive/5 p-4 mb-6">
                        <p className="text-sm">
                            Le paiement a été annulé. Tu peux réessayer ci-dessous.
                        </p>
                    </div>
                )}

                <EventRegistrationForm
                    eventId={event.id}
                    priceCents={event.price_cents}
                    initialFullName={profile?.full_name ?? ""}
                    initialPhone={profile?.phone ?? ""}
                />
            </div>
        </section>
    );
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString("fr-BE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}