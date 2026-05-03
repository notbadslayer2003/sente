import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";
import {ArrowLeft, Calendar, MapPin, Users, Award, Wrench, Shield} from "lucide-react";
import {getEventDetail} from "@/lib/dal/events";

const EVENT_TYPE_LABELS: Record<string, string> = {
    concours: "Concours",
    journee_decouverte: "Journée découverte",
    stage: "Stage",
    assemblee: "Assemblée",
    autre: "Autre",
};

const ESPECE_LABELS: Record<string, string> = {
    carpe: "Carpe", silure: "Silure", brochet: "Brochet", sandre: "Sandre",
    perche: "Perche", truite: "Truite", black_bass: "Black bass",
    gardon: "Gardon", tanche: "Tanche", esturgeon: "Esturgeon",
    salmonide: "Salmonidé", carnassier: "Carnassier", blanc: "Blanc",
};

const NIVEAU_LABELS: Record<string, string> = {
    debutant: "Débutant",
    intermediaire: "Intermédiaire",
    expert: "Expert",
    tous_niveaux: "Tous niveaux",
};

type Params = Promise<{ id: string }>;

export async function generateMetadata({params}: { params: Params }) {
    const {id} = await params;
    const event = await getEventDetail(id);
    if (!event) return {title: "Événement introuvable — Sente"};
    return {
        title: `${event.title} — Sente`,
        description: event.description ?? `Événement organisé par ${event.organization.name}`,
        openGraph: {
            title: event.title,
            description: event.description ?? undefined,
            images: event.cover_image_url ? [event.cover_image_url] : undefined,
        },
    };
}

export default async function EventDetailPage({params}: { params: Params }) {
    const {id} = await params;
    const event = await getEventDetail(id);
    if (!event) notFound();

    const isFree = event.price_cents === 0;
    const placesLeft = event.max_participants
        ? Math.max(0, event.max_participants - event.registrations_count)
        : null;
    const isFull = placesLeft !== null && placesLeft === 0;
    const isCancelled = event.status === "cancelled";
    const isPast = new Date(event.starts_at) < new Date();
    const orgHref =
        event.organization.org_type === "etang"
            ? `/lieux/${event.organization.slug}`
            : `/magasins/${event.organization.slug}`;

    return (
        <>
            {/* Hero */}
            <section className="relative h-[50vh] min-h-[360px] w-full overflow-hidden">
                {event.cover_image_url ? (
                    <Image
                        src={event.cover_image_url}
                        alt={event.title}
                        fill
                        priority
                        className="object-cover"
                        sizes="100vw"
                        unoptimized
                    />
                ) : (
                    <div className="absolute inset-0 bg-secondary"/>
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/80"/>
                <div
                    className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-full flex flex-col justify-end pb-12">
                    <Link
                        href="/evenements"
                        className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-white/85 hover:text-white transition-colors mb-6"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2}/>
                        Retour aux événements
                    </Link>

                    <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-white/15 backdrop-blur-sm text-white text-xs uppercase tracking-wide">
              {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
            </span>
                        {isCancelled && (
                            <span className="px-3 py-1 bg-destructive text-background text-xs uppercase tracking-wide">
                Événement annulé
              </span>
                        )}
                        {isPast && !isCancelled && (
                            <span className="px-3 py-1 bg-white/15 text-white text-xs uppercase tracking-wide">
                Événement passé
              </span>
                        )}
                    </div>

                    <h1 className="font-display-soft text-white text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95] max-w-4xl">
                        {event.title}
                    </h1>
                    <p className="mt-4 text-white/85">
                        Par{" "}
                        <Link href={orgHref} className="underline hover:text-white">
                            {event.organization.name}
                        </Link>
                    </p>
                </div>
            </section>

            {/* Body */}
            <section className="bg-background py-16 sm:py-20 border-b border-border">
                <div
                    className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
                    <div className="lg:col-span-7 space-y-12">
                        {isCancelled && event.cancellation_reason && (
                            <div className="border border-destructive/30 bg-destructive/5 p-5">
                                <p className="text-xs uppercase tracking-[0.25em] text-destructive">
                                    Motif d&apos;annulation
                                </p>
                                <p className="mt-2 text-sm leading-relaxed">{event.cancellation_reason}</p>
                            </div>
                        )}

                        {event.description && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Description
                                </p>
                                <p className="mt-4 text-base leading-relaxed whitespace-pre-line">
                                    {event.description}
                                </p>
                            </div>
                        )}

                        {(event.espece_cible || event.niveau) && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Détails
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {event.espece_cible && (
                                        <span
                                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary border border-border">
                      <Award className="w-3.5 h-3.5" strokeWidth={2}/>
                                            {ESPECE_LABELS[event.espece_cible] ?? event.espece_cible}
                    </span>
                                    )}
                                    {event.niveau && (
                                        <span
                                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary border border-border">
                      <Shield className="w-3.5 h-3.5" strokeWidth={2}/>
                                            {NIVEAU_LABELS[event.niveau] ?? event.niveau}
                    </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {event.materiel_fourni && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
                                    <Wrench className="w-3.5 h-3.5" strokeWidth={2}/>
                                    Matériel fourni
                                </p>
                                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">
                                    {event.materiel_fourni}
                                </p>
                            </div>
                        )}

                        {event.materiel_a_apporter && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    À apporter
                                </p>
                                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">
                                    {event.materiel_a_apporter}
                                </p>
                            </div>
                        )}
                    </div>

                    <aside className="lg:col-span-5">
                        <div className="border border-border bg-secondary/30 p-8 space-y-6 sticky top-24">
                            {/* Date */}
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5" strokeWidth={2}/>
                                    Date & heure
                                </p>
                                <p className="mt-3 text-base">
                                    {formatLong(event.starts_at)}
                                    {event.ends_at && (
                                        <>
                                            <br/>
                                            <span className="text-sm text-muted-foreground">
                        Jusqu&apos;à {formatLong(event.ends_at)}
                      </span>
                                        </>
                                    )}
                                </p>
                            </div>

                            {/* Lieu */}
                            {event.location_text && (
                                <div className="pt-6 border-t border-border">
                                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
                                        <MapPin className="w-3.5 h-3.5" strokeWidth={2}/>
                                        Lieu
                                    </p>
                                    <p className="mt-3 text-sm leading-relaxed">{event.location_text}</p>
                                    {event.location_lat && event.location_lng && (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${event.location_lat},${event.location_lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-3 inline-block text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                        >
                                            Voir l&apos;itinéraire →
                                        </a>
                                    )}
                                </div>
                            )}

                            {/* Inscriptions */}
                            <div className="pt-6 border-t border-border">
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" strokeWidth={2}/>
                                    Inscriptions
                                </p>
                                <p className="mt-3 text-base tabular-nums">
                                    {event.registrations_count}
                                    {event.max_participants && (
                                        <span className="text-muted-foreground"> / {event.max_participants}</span>
                                    )}
                                </p>
                                {placesLeft !== null && placesLeft > 0 && placesLeft <= 5 && !isFull && (
                                    <p className="mt-1 text-xs text-destructive">
                                        Plus que {placesLeft} place{placesLeft > 1 ? "s" : ""}
                                    </p>
                                )}
                            </div>

                            {/* Prix */}
                            <div className="pt-6 border-t border-border">
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Tarif
                                </p>
                                <p className="mt-3 font-display text-3xl tracking-tight">
                                    {isFree ? "Gratuit" : `${(event.price_cents / 100).toFixed(0)} €`}
                                </p>
                            </div>

                            {/* CTA inscription : placeholder, on l'implémente en session B */}
                            <div className="pt-6 border-t border-border">
                                {isCancelled ? (
                                    <p className="text-sm text-destructive">
                                        Cet événement a été annulé.
                                    </p>
                                ) : isPast ? (
                                    <p className="text-sm text-muted-foreground">
                                        Cet événement est passé.
                                    </p>
                                ) : isFull ? (
                                    <p className="text-sm text-muted-foreground">
                                        Cet événement est complet.
                                    </p>
                                ) : event.is_registered_by_me ? (
                                    <div className="text-center">
                                        <p className="text-sm text-primary mb-2">Tu es inscrit ✓</p>
                                        <Link
                                            href={`/profil/inscriptions`}
                                            className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                                        >
                                            Voir mes inscriptions →
                                        </Link>
                                    </div>
                                ) : event.is_org_member ? (
                                    <p className="text-sm text-muted-foreground italic">
                                        En tant que membre de l&apos;organisation, tu n&apos;as pas besoin de
                                        t&apos;inscrire.
                                    </p>
                                ) : (
                                    <Link
                                        href={`/evenements/${event.id}/inscription`}
                                        className="block w-full text-center bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3 text-sm uppercase tracking-wide font-medium"
                                    >
                                        S&apos;inscrire
                                    </Link>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </section>
        </>
    );
}

function formatLong(iso: string): string {
    return new Date(iso).toLocaleString("fr-BE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}