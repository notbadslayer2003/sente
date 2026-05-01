import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getLieuBySlug, getLieux } from "@/lib/data/lieux";
import {
    EspeceLabel,
    PaysLabel,
    ProvinceLabel,
} from "@/lib/schemas/lieu";
import { Badge } from "@/components/ui/badge";
import { LieuCard } from "@/components/sente/lieu-card";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
    const { slug } = await params;
    const lieu = await getLieuBySlug(slug);
    if (!lieu) return { title: "Étang introuvable — Sente" };
    return {
        title: `${lieu.nom} — Sente`,
        description: lieu.description,
    };
}

export default async function LieuPage({ params }: { params: Params }) {
    const { slug } = await params;
    const lieu = await getLieuBySlug(slug);
    if (!lieu) notFound();

    // Étangs similaires (même pays, hors lui-même, max 3)
    const all = await getLieux({ pays: lieu.pays });
    const similaires = all.filter((l) => l.id !== lieu.id).slice(0, 3);

    return (
        <>
            {/* Hero photo */}
            <section className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
                <Image
                    src={lieu.photos[0]}
                    alt={lieu.nom}
                    fill
                    priority
                    className="object-cover"
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/80" />

                <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-full flex flex-col justify-end pb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/85">
                        {PaysLabel[lieu.pays]} · {ProvinceLabel[lieu.province]} · {lieu.commune}
                    </p>
                    <h1 className="mt-3 font-display-soft text-white text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95] max-w-4xl">
                        {lieu.nom}
                    </h1>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        {lieu.reglement.noKill && (
                            <Badge className="bg-primary text-primary-foreground border-0">
                                No-kill
                            </Badge>
                        )}
                        {lieu.reservable && (
                            <Badge className="bg-accent text-accent-foreground border-0">
                                Réservable
                            </Badge>
                        )}
                        {lieu.noteMoyenne && (
                            <span className="text-white/85 text-sm">
                ★ {lieu.noteMoyenne.toFixed(1)} · {lieu.nbAvis} avis
              </span>
                        )}
                    </div>
                </div>
            </section>

            {/* Corps */}
            <section className="bg-background py-16 sm:py-24 border-b border-border">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
                    {/* Colonne principale */}
                    <div className="lg:col-span-7 space-y-12">
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                À propos
                            </p>
                            <p className="mt-4 text-base sm:text-lg leading-relaxed">
                                {lieu.description}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                Espèces présentes
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {lieu.especes.map((e) => (
                                    <Badge key={e} variant="secondary">
                                        {EspeceLabel[e]}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                Règlement
                            </p>
                            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                <Rule label="No-kill" value={lieu.reglement.noKill} />
                                <Rule label="Bait-boat autorisé" value={lieu.reglement.baitboatAutorise} />
                                <Rule label="Pêche de nuit" value={lieu.reglement.nuitAutorisee} />
                                <Rule label="Permis requis" value={lieu.reglement.permisRequis} />
                                <Rule
                                    label="Cannes max"
                                    valueText={`${lieu.reglement.nbCannesMax}`}
                                />
                            </dl>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <aside className="lg:col-span-5">
                        <div className="border border-border bg-secondary/30 p-8 space-y-6 sticky top-24">
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Caractéristiques
                                </p>
                                <dl className="mt-4 space-y-3 text-sm">
                                    <Stat label="Superficie" value={`${lieu.superficieHa} ha`} />
                                    {lieu.profondeurMaxM && (
                                        <Stat
                                            label="Profondeur max"
                                            value={`${lieu.profondeurMaxM} m`}
                                        />
                                    )}
                                    {lieu.postesCount > 0 && (
                                        <Stat label="Postes" value={`${lieu.postesCount}`} />
                                    )}
                                    {lieu.recordKg && (
                                        <Stat label="Record" value={`${lieu.recordKg} kg`} />
                                    )}
                                </dl>
                            </div>

                            <div className="pt-6 border-t border-border">
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Tarifs
                                </p>
                                <dl className="mt-4 space-y-2 text-sm">
                                    <Stat label="Journée" value={`${lieu.tarif.jour} €`} highlight />
                                    {lieu.tarif.nuit !== undefined && (
                                        <Stat label="Nuit" value={`${lieu.tarif.nuit} €`} />
                                    )}
                                    {lieu.tarif.forfait48h !== undefined && (
                                        <Stat label="48 h" value={`${lieu.tarif.forfait48h} €`} />
                                    )}
                                    {lieu.tarif.semaine !== undefined && (
                                        <Stat label="Semaine" value={`${lieu.tarif.semaine} €`} />
                                    )}
                                </dl>
                            </div>

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
                                        value={new URL(lieu.contact.siteWeb).hostname}
                                        href={lieu.contact.siteWeb}
                                        external
                                    />
                                )}
                                {!lieu.contact.email &&
                                    !lieu.contact.telephone &&
                                    !lieu.contact.siteWeb && (
                                        <p className="text-sm text-muted-foreground">
                                            Aucun contact public renseigné.
                                        </p>
                                    )}
                            </div>

                            {lieu.reservable && (
                                <Link
                                    href="/contact"
                                    className="block w-full text-center bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3 text-sm font-medium tracking-wide uppercase"
                                >
                                    Demander une réservation
                                </Link>
                            )}
                        </div>
                    </aside>
                </div>
            </section>

            {/* Étangs similaires */}
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
                                <LieuCard key={l.id} lieu={l} />
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}

function Rule({
                  label,
                  value,
                  valueText,
              }: {
    label: string;
    value?: boolean;
    valueText?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">
                {valueText ?? (value ? "Oui" : "Non")}
            </dd>
        </div>
    );
}

function Stat({
                  label,
                  value,
                  highlight = false,
              }: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd
                className={`${
                    highlight ? "font-display text-2xl text-accent" : "font-medium"
                }`}
            >
                {value}
            </dd>
        </div>
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