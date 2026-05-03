"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    publishEventAction,
    cancelEventAction,
    deleteDraftEventAction,
} from "@/app/actions/events";
import type { EventListItem } from "@/lib/dal/events";

const EVENT_TYPE_LABELS: Record<string, string> = {
    concours: "Concours",
    journee_decouverte: "Journée découverte",
    stage: "Stage",
    assemblee: "Assemblée",
    autre: "Autre",
};

export function EventManagerCard({
                                     event,
                                     dashboardSlug,
                                 }: {
    event: EventListItem;
    dashboardSlug: string;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");

    const onPublish = () => {
        if (!confirm("Publier cet événement ? Il sera visible par tous les pêcheurs.")) return;
        const fd = new FormData();
        fd.set("event_id", event.id);
        startTransition(async () => {
            const r = await publishEventAction(fd);
            if (r.ok) router.refresh();
            else setError(r.error);
        });
    };

    const onDelete = () => {
        if (!confirm("Supprimer ce brouillon ? Action irréversible.")) return;
        const fd = new FormData();
        fd.set("event_id", event.id);
        startTransition(async () => {
            const r = await deleteDraftEventAction(fd);
            if (r.ok) router.refresh();
            else setError(r.error);
        });
    };

    const onCancel = () => {
        if (cancelReason.trim().length < 10) {
            setError("Raison trop courte (min 10 caractères).");
            return;
        }
        const fd = new FormData();
        fd.set("event_id", event.id);
        fd.set("reason", cancelReason.trim());
        startTransition(async () => {
            const r = await cancelEventAction(fd);
            if (r.ok) {
                setCancelOpen(false);
                router.refresh();
            } else {
                setError(r.error);
            }
        });
    };

    const isFree = event.price_cents === 0;
    const placesLeft = event.max_participants
        ? Math.max(0, event.max_participants - event.registrations_count)
        : null;
    const isPast = new Date(event.starts_at) < new Date();

    return (
        <article className="border border-border bg-secondary/10">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 p-5 items-start">
                {/* Cover */}
                <div className="sm:col-span-3 relative aspect-[16/10] bg-background border border-border overflow-hidden">
                    {event.cover_image_url ? (
                        <Image
                            src={event.cover_image_url}
                            alt={event.title}
                            fill
                            sizes="(max-width: 640px) 100vw, 200px"
                            className="object-cover"
                            unoptimized
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground uppercase">
                            Sans cover
                        </div>
                    )}
                </div>

                {/* Infos */}
                <div className="sm:col-span-6 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={event.status} />
                        <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-secondary border border-border">
              {EVENT_TYPE_LABELS[event.event_type]}
            </span>
                    </div>
                    <h3 className="font-display text-lg leading-tight">{event.title}</h3>
                    <p className="text-xs text-muted-foreground">
                        {formatDate(event.starts_at)}
                        {event.location_text && ` · ${event.location_text}`}
                    </p>
                    <p className="text-xs">
                        <span className="text-muted-foreground">Inscriptions : </span>
                        <span className="tabular-nums">{event.registrations_count}</span>
                        {event.max_participants && (
                            <span className="text-muted-foreground"> / {event.max_participants}</span>
                        )}
                        {" · "}
                        <span className="text-muted-foreground">Prix : </span>
                        <span className="tabular-nums">
              {isFree ? "Gratuit" : `${(event.price_cents / 100).toFixed(0)} €`}
            </span>
                    </p>
                </div>

                {/* Actions */}
                <div className="sm:col-span-3 flex flex-col gap-2 items-stretch sm:items-end">
                    <Link
                        href={`/evenements/${event.id}`}
                        target="_blank"
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors text-right"
                    >
                        Voir la page publique →
                    </Link>
                    <Link
                        href={`/dashboard/${dashboardSlug}/evenements/${event.id}/inscrits`}
                        className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 self-end hover:text-accent hover:border-accent transition-colors"
                    >
                        Inscrits ({event.registrations_count})
                    </Link>
                    {event.status !== "cancelled" && !isPast && (
                        <Link
                            href={`/dashboard/${dashboardSlug}/evenements/${event.id}/edit`}
                            className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors text-right"
                        >
                            Éditer →
                        </Link>
                    )}
                    {event.status === "draft" && (
                        <>
                            <button
                                type="button"
                                onClick={onPublish}
                                disabled={isPending}
                                className="text-xs uppercase tracking-wide bg-accent text-accent-foreground px-3 py-1.5 hover:bg-accent/90 transition-colors disabled:opacity-50"
                            >
                                Publier
                            </button>
                            <button
                                type="button"
                                onClick={onDelete}
                                disabled={isPending}
                                className="text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors text-right disabled:opacity-50"
                            >
                                Supprimer le brouillon
                            </button>
                        </>
                    )}
                    {event.status === "published" && !isPast && (
                        <button
                            type="button"
                            onClick={() => setCancelOpen(!cancelOpen)}
                            disabled={isPending}
                            className="text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors text-right disabled:opacity-50"
                        >
                            {cancelOpen ? "Annuler" : "Annuler l'événement"}
                        </button>
                    )}
                </div>
            </div>

            {/* Form annulation */}
            {cancelOpen && (
                <div className="border-t border-border bg-destructive/5 p-5 space-y-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-destructive">
                        Annuler l&apos;événement
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Les inscrits seront notifiés. Tu pourras rembourser individuellement chaque
                        inscrit depuis la liste des inscrits.
                    </p>
                    <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={2}
                        minLength={10}
                        maxLength={1000}
                        placeholder="Raison de l'annulation (visible des inscrits)"
                        className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-destructive resize-y"
                    />
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isPending}
                            className="text-xs uppercase tracking-wide bg-destructive text-background px-4 py-2 hover:bg-destructive/90 transition-colors disabled:opacity-50"
                        >
                            {isPending ? "..." : "Confirmer l'annulation"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setCancelOpen(false)}
                            disabled={isPending}
                            className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        >
                            Garder l&apos;événement
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="border-t border-border px-5 py-3 bg-destructive/5">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}
        </article>
    );
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; className: string }> = {
        draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
        published: { label: "Publié", className: "bg-primary/15 text-primary" },
        cancelled: { label: "Annulé", className: "bg-destructive/15 text-destructive" },
        completed: { label: "Terminé", className: "bg-secondary text-foreground" },
    };
    const v = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
    return (
        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wide ${v.className}`}>
      {v.label}
    </span>
    );
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString("fr-BE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}