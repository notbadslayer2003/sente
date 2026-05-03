import Link from "next/link";
import { getUpcomingEvents } from "@/lib/dal/events";
import { EventCard } from "@/components/sente/event-card";

export const metadata = {
    title: "Événements pêche — Sente",
    description: "Concours, journées découvertes, stages : tous les événements pêche en Wallonie et en France.",
};

export default async function EvenementsPage() {
    const events = await getUpcomingEvents({ limit: 50 });

    return (
        <section className="bg-background min-h-screen pt-24 pb-20">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <div className="mb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Communauté
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl sm:text-6xl tracking-tight leading-[0.95]">
                        Événements pêche.
                    </h1>
                    <p className="mt-6 text-base text-muted-foreground max-w-2xl leading-relaxed">
                        Concours, journées découvertes, stages, assemblées. Inscris-toi
                        en quelques clics aux événements organisés par les étangs et magasins partenaires.
                    </p>
                </div>

                {events.length === 0 ? (
                    <div className="border border-dashed border-border p-16 text-center">
                        <p className="text-sm text-muted-foreground mb-4">
                            Aucun événement à venir pour le moment.
                        </p>
                        <Link
                            href="/lieux"
                            className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                        >
                            Découvrir des étangs →
                        </Link>
                    </div>
                ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((e) => (
                            <li key={e.id}>
                                <EventCard event={e} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}