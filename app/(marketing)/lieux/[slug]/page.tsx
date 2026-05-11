import {notFound} from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {getLieuBySlug, getLieux} from "@/lib/data/lieux";
import {PaysLabel, ProvinceLabel, EspeceLabel} from "@/lib/schemas/lieu";
import {Badge} from "@/components/ui/badge";
import {LieuCard} from "@/components/sente/lieu-card";
import { getFollowStatus } from "@/lib/dal/follow-status";
import { FollowButton } from "@/components/sente/follow-button";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingEvents } from "@/lib/dal/events";
import { EventCard } from "@/components/sente/event-card";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({params}: { params: Params }) {
    const {slug} = await params;
    const lieu = await getLieuBySlug(slug);
    if (!lieu) return {title: "Étang introuvable — Sente"};
    return {
        title: `${lieu.nom} — Sente`,
        description: lieu.description,
    };
}

export default async function LieuPage({params}: { params: Params }) {
    const {slug} = await params;
    const lieu = await getLieuBySlug(slug);
    if (!lieu) notFound();
    const followStatus = lieu.id ? await getFollowStatus(lieu.id) : { following: false, followers_count: 0 };
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const all = await getLieux({pays: lieu.pays});
    const similaires = all.filter((l) => l.id !== lieu.id).slice(0, 3);

    return (
        <>
            {/* Hero photo */}
            <section className="relative h-[55vh] min-h-[380px] w-full overflow-hidden">
                {lieu.photos[0] && (
                    <Image
                        src={lieu.coverImageUrl ?? lieu.photos[0]}
                        alt={lieu.nom}
                        fill
                        priority
                        className="object-cover"
                        sizes="100vw"
                        unoptimized
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/80"/>

                <div
                    className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-full flex flex-col justify-end pb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/85">
                        {PaysLabel[lieu.pays]} · {ProvinceLabel[lieu.province]} ·{" "}
                        {lieu.commune}
                    </p>
                    <h1 className="mt-3 font-display-soft text-white text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95] max-w-4xl">
                        {lieu.nom}
                    </h1>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                        {lieu.reservable && (
                            <Badge className="bg-primary text-primary-foreground border-0">
                                Réservable
                            </Badge>
                        )}
                        {lieu.noteMoyenne && (
                            <span className="text-white/85 text-sm">
                                ★ {lieu.noteMoyenne.toFixed(1)} · {lieu.nbAvis} avis
                            </span>
                        )}
                        {lieu.id && (
                            <FollowButton
                                orgId={lieu.id}
                                initialFollowing={followStatus.following}
                                initialFollowersCount={followStatus.followers_count}
                                isLoggedIn={!!user}
                                tone="dark"
                            />
                        )}
                    </div>
                </div>
            </section>

            {/* Corps */}
            <section className="bg-background py-16 sm:py-24 border-b border-border">
                <div
                    className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
                    <div className="lg:col-span-7 space-y-12">
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                À propos
                            </p>
                            <p className="mt-4 text-base sm:text-lg leading-relaxed whitespace-pre-line">
                                {lieu.description}
                            </p>
                        </div>

                        {lieu.especes.length > 0 && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Espèces présentes
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {lieu.especes.map((e) => (
                                        <Badge key={e} variant="secondary">
                                            {EspeceLabel[e] ?? e}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Caractéristiques */}
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                Caractéristiques
                            </p>
                            <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
                                {lieu.superficieHa > 0 && (
                                    <Stat label="Superficie" value={`${lieu.superficieHa} ha`}/>
                                )}
                                {lieu.profondeurMaxM && (
                                    <Stat
                                        label="Profondeur max"
                                        value={`${lieu.profondeurMaxM} m`}
                                    />
                                )}
                                {lieu.recordKg && (
                                    <Stat label="Record" value={`${lieu.recordKg} kg`}/>
                                )}
                                {lieu.postesCount > 0 && (
                                    <Stat label="Postes" value={`${lieu.postesCount}`}/>
                                )}
                            </dl>
                        </div>

                        {/* Règlement */}
                        {lieu.reglement && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Règlement
                                </p>
                                <ul className="mt-4 space-y-3 text-sm">
                                    <RuleItem
                                        active={lieu.reglement.noKill}
                                        labelOn="No-kill obligatoire"
                                        labelOff="Conservation autorisée"
                                    />
                                    <RuleItem
                                        active={lieu.reglement.nuitAutorisee}
                                        labelOn="Pêche de nuit autorisée"
                                        labelOff="Pêche de nuit interdite"
                                    />
                                    <RuleItem
                                        active={lieu.reglement.baitboatAutorise}
                                        labelOn="Bait-boat autorisé"
                                        labelOff="Bait-boat interdit"
                                    />
                                    <RuleItem
                                        active={lieu.reglement.permisRequis}
                                        labelOn="Permis de pêche requis"
                                        labelOff="Permis non requis"
                                    />
                                    <li className="flex items-start gap-3">
                                        <span className="mt-1.5 w-2 h-2 rounded-full bg-foreground shrink-0"/>
                                        <span>
                                            <strong>{lieu.reglement.nbCannesMax}</strong> canne
                                            {lieu.reglement.nbCannesMax > 1 ? "s" : ""} maximum
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        )}

                        {/* Galerie */}
                        {lieu.photos.length > 0 && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Galerie
                                </p>
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {lieu.photos.slice(0).map((url, i) => (
                                        <div
                                            key={url}
                                            className="relative aspect-square bg-secondary border border-border overflow-hidden"
                                        >
                                            <Image
                                                src={url}
                                                alt={`${lieu.nom} — photo ${i + 2}`}
                                                fill
                                                sizes="(max-width: 768px) 50vw, 25vw"
                                                className="object-cover"
                                                unoptimized
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <aside className="lg:col-span-5">
                        <div className="border border-border bg-secondary/30 p-8 space-y-6 sticky top-24">
                            {lieu.tarif.jour > 0 && (
                                <div>
                                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                        Tarifs
                                    </p>
                                    <div className="mt-3 space-y-2">
                                        <PriceRow label="Journée" amount={lieu.tarif.jour}/>
                                    </div>
                                    {lieu.reservable && (
                                        <p className="mt-4 text-xs text-muted-foreground">
                                            Réservation en ligne — bientôt.
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="pt-6 border-t border-border">
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Localisation
                                </p>
                                <p className="mt-3 text-sm leading-relaxed">
                                    {lieu.commune}, {ProvinceLabel[lieu.province]}
                                </p>
                                {lieu.coordonnees.lat !== 0 &&
                                    lieu.coordonnees.lng !== 0 && (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${lieu.coordonnees.lat},${lieu.coordonnees.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-3 inline-block text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                        >
                                            Voir l&apos;itinéraire →
                                        </a>
                                    )}
                            </div>

                            {(lieu.contact.email ||
                                lieu.contact.telephone ||
                                lieu.contact.siteWeb) && (
                                <div className="pt-6 border-t border-border space-y-3">
                                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                        Contact
                                    </p>
                                    {lieu.contact.email && (
                                        <ContactRow
                                            label="Email"
                                            value={lieu.contact.email}
                                            href={`mailto:${lieu.contact.email}`}
                                        />
                                    )}
                                    {lieu.contact.telephone && (
                                        <ContactRow
                                            label="Téléphone"
                                            value={lieu.contact.telephone}
                                            href={`tel:${lieu.contact.telephone.replace(/\s/g, "")}`}
                                        />
                                    )}
                                    {lieu.contact.siteWeb && (
                                        <ContactRow
                                            label="Site web"
                                            value={hostnameOf(lieu.contact.siteWeb)}
                                            href={lieu.contact.siteWeb}
                                            external
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </section>

            {lieu.id && (
                <UpcomingEventsSection orgId={lieu.id} />
            )}
            {similaires.length > 0 && (
                <section className="bg-secondary/40 py-16 sm:py-24">
                    <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                        <div className="flex items-end justify-between mb-10">
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    À voir aussi
                                </p>
                                <h2 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight">
                                    En {PaysLabel[lieu.pays]}
                                </h2>
                            </div>
                            <Link
                                href="/lieux"
                                className="text-sm font-medium uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                            >
                                Tous les étangs →
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {similaires.map((l) => (
                                <LieuCard key={l.id} lieu={l}/>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}

function ContactRow({
                        label,
                        value,
                        href,
                        external = false,
                    }: {
    label: string;
    value: string;
    href: string;
    external?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <a
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="hover:text-accent transition-colors truncate max-w-[200px]"
            >
                {value}
            </a>
        </div>
    );
}

function Stat({label, value}: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {label}
            </dt>
            <dd className="mt-1 font-display text-xl">{value}</dd>
        </div>
    );
}

function PriceRow({label, amount}: { label: string; amount: number }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="font-display text-xl">{amount.toFixed(0)} €</span>
        </div>
    );
}

function RuleItem({
                      active,
                      labelOn,
                      labelOff,
                  }: {
    active: boolean;
    labelOn: string;
    labelOff: string;
}) {
    return (
        <li className="flex items-start gap-3">
            <span
                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    active ? "bg-primary" : "bg-muted-foreground/40"
                }`}
            />
            <span className={active ? "" : "text-muted-foreground"}>
                {active ? labelOn : labelOff}
            </span>
        </li>
    );
}

function hostnameOf(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

async function UpcomingEventsSection({ orgId }: { orgId: string }) {
    const events = await getUpcomingEvents({ orgId, limit: 3 });
    if (events.length === 0) return null;

    return (
        <section className="bg-background py-16 sm:py-20 border-b border-border">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            À venir
                        </p>
                        <h2 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight">
                            Événements
                        </h2>
                    </div>
                    <Link
                        href="/evenements"
                        className="text-sm font-medium uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                    >
                        Tous les événements →
                    </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((e) => (
                        <EventCard key={e.id} event={e} />
                    ))}
                </div>
            </div>
        </section>
    );
}