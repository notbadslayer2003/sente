import Image from "next/image";
import Link from "next/link";
import { Calendar, MapPin, Users } from "lucide-react";
import type { EventListItem } from "@/lib/dal/events";

const EVENT_TYPE_LABELS: Record<string, string> = {
    concours: "Concours",
    journee_decouverte: "Journée découverte",
    stage: "Stage",
    assemblee: "Assemblée",
    autre: "Autre",
};

export function EventCard({ event }: { event: EventListItem }) {
    const isFree = event.price_cents === 0;
    const placesLeft = event.max_participants
        ? Math.max(0, event.max_participants - event.registrations_count)
        : null;
    const isFull = placesLeft !== null && placesLeft === 0;
    const isCancelled = event.status === "cancelled";

    return (
        <Link
            href={`/evenements/${event.id}`}
            className="block group border border-border bg-secondary/10 hover:bg-secondary/30 transition-colors h-full"
        >
            {/* Cover */}
            <div className="relative w-full aspect-[16/10] bg-background overflow-hidden">
                {event.cover_image_url ? (
                    <Image
                        src={event.cover_image_url}
                        alt={event.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        unoptimized
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40 text-xs uppercase tracking-wide">
                        Aucune photo
                    </div>
                )}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-background/90 text-[10px] uppercase tracking-wide">
            {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
          </span>
                    {isCancelled && (
                        <span className="px-2 py-1 bg-destructive text-background text-[10px] uppercase tracking-wide">
              Annulé
            </span>
                    )}
                    {isFull && !isCancelled && (
                        <span className="px-2 py-1 bg-foreground text-background text-[10px] uppercase tracking-wide">
              Complet
            </span>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3">
                <h3 className="font-display text-xl tracking-tight leading-tight line-clamp-2 group-hover:text-accent transition-colors">
                    {event.title}
                </h3>

                <p className="text-xs text-muted-foreground">
                    Par <span className="text-foreground">{event.organization.name}</span>
                </p>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                        <span>{formatEventDate(event.starts_at)}</span>
                    </div>
                    {event.location_text && (
                        <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                            <span className="truncate">{event.location_text}</span>
                        </div>
                    )}
                    {event.max_participants && (
                        <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                            <span>
                {event.registrations_count} / {event.max_participants} inscrits
              </span>
                        </div>
                    )}
                </div>

                <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="font-display text-lg tabular-nums">
            {isFree ? "Gratuit" : `${(event.price_cents / 100).toFixed(0)} €`}
          </span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground group-hover:text-accent transition-colors">
            Voir →
          </span>
                </div>
            </div>
        </Link>
    );
}

function formatEventDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString("fr-BE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}