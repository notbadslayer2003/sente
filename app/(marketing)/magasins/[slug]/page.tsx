import {notFound} from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {getMagasinBySlug, getMagasins} from "@/lib/data/magasins";
import {PaysLabel, ProvinceLabel} from "@/lib/schemas/lieu";
import {SpecialiteLabel} from "@/lib/schemas/magasin";
import {Badge} from "@/components/ui/badge";
import {MagasinCard} from "@/components/sente/magasin-card";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({params}: { params: Params }) {
    const {slug} = await params;
    const magasin = await getMagasinBySlug(slug);
    if (!magasin) return {title: "Magasin introuvable — Sente"};
    return {
        title: `${magasin.nom} — Sente`,
        description: magasin.description,
    };
}

export default async function MagasinPage({params}: { params: Params }) {
    const {slug} = await params;
    const magasin = await getMagasinBySlug(slug);
    if (!magasin) notFound();

    const all = await getMagasins({pays: magasin.pays});
    const similaires = all.filter((m) => m.id !== magasin.id).slice(0, 3);

    return (
        <>
            {/* Hero photo */}
            <section className="relative h-[55vh] min-h-[380px] w-full overflow-hidden">
                {magasin.photos[0] && (
                    <Image
                        src={magasin.photos[0]}
                        alt={magasin.nom}
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
                        {PaysLabel[magasin.pays]} · {ProvinceLabel[magasin.province]} ·{" "}
                        {magasin.ville}
                    </p>
                    <h1 className="mt-3 font-display-soft text-white text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[0.95] max-w-4xl">
                        {magasin.nom}
                    </h1>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        {magasin.partenaire && (
                            <Badge className="bg-primary text-primary-foreground border-0">
                                Partenaire
                            </Badge>
                        )}
                        {magasin.noteMoyenne && (
                            <span className="text-white/85 text-sm">
                                ★ {magasin.noteMoyenne.toFixed(1)} · {magasin.nbAvis} avis
                            </span>
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
                                {magasin.description}
                            </p>
                        </div>

                        {magasin.specialites.length > 0 && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Spécialités
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {magasin.specialites.map((s) => (
                                        <Badge key={s} variant="secondary">
                                            {SpecialiteLabel[s] ?? s}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {magasin.marques.length > 0 && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Marques distribuées
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {magasin.marques.map((m) => (
                                        <span
                                            key={m}
                                            className="text-sm border border-border px-3 py-1 bg-secondary/40"
                                        >
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Galerie photos secondaires */}
                        {magasin.photos.length > 1 && (
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Galerie
                                </p>
                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {magasin.photos.slice(1).map((url, i) => (
                                        <div
                                            key={url}
                                            className="relative aspect-square bg-secondary border border-border overflow-hidden"
                                        >
                                            <Image
                                                src={url}
                                                alt={`${magasin.nom} — photo ${i + 2}`}
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

                        {magasin.partenaire && (
                            <div className="border border-border bg-secondary/30 p-8">
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    E-commerce
                                </p>
                                <h3 className="mt-3 font-display text-2xl tracking-tight">
                                    Boutique en ligne — bientôt disponible
                                </h3>
                                <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xl">
                                    Ce magasin partenaire ouvrira prochainement sa boutique sur
                                    Sente. Vous pourrez commander en ligne, paiement sécurisé,
                                    livraison ou retrait sur place.
                                </p>
                            </div>
                        )}
                    </div>

                    <aside className="lg:col-span-5">
                        <div className="border border-border bg-secondary/30 p-8 space-y-6 sticky top-24">
                            {magasin.adresse && (
                                <div>
                                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                        Adresse
                                    </p>
                                    <p className="mt-3 text-sm leading-relaxed">
                                        {magasin.adresse}
                                    </p>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                            magasin.adresse
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-3 inline-block text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                                    >
                                        Voir l&apos;itinéraire →
                                    </a>
                                </div>
                            )}

                            {magasin.horaires && (
                                <div className="pt-6 border-t border-border">
                                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                        Horaires
                                    </p>
                                    <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">
                                        {magasin.horaires}
                                    </p>
                                </div>
                            )}

                            <div className="pt-6 border-t border-border space-y-3">
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    Contact
                                </p>
                                {magasin.contact.email && (
                                    <ContactRow
                                        label="Email"
                                        value={magasin.contact.email}
                                        href={`mailto:${magasin.contact.email}`}
                                    />
                                )}
                                {magasin.contact.telephone && (
                                    <ContactRow
                                        label="Téléphone"
                                        value={magasin.contact.telephone}
                                        href={`tel:${magasin.contact.telephone.replace(/\s/g, "")}`}
                                    />
                                )}
                                {magasin.contact.siteWeb && (
                                    <ContactRow
                                        label="Site web"
                                        value={hostnameOf(magasin.contact.siteWeb)}
                                        href={magasin.contact.siteWeb}
                                        external
                                    />
                                )}
                                {magasin.contact.instagram && (
                                    <ContactRow
                                        label="Instagram"
                                        value={magasin.contact.instagram}
                                        href={instagramUrl(magasin.contact.instagram)}
                                        external
                                    />
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </section>

            {/* Magasins similaires */}
            {similaires.length > 0 && (
                <section className="bg-secondary/40 py-16 sm:py-24">
                    <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                        <div className="flex items-end justify-between mb-10">
                            <div>
                                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                    À voir aussi
                                </p>
                                <h2 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight">
                                    En {PaysLabel[magasin.pays]}
                                </h2>
                            </div>
                            <Link
                                href="/magasins"
                                className="text-sm font-medium uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                            >
                                Tous les magasins →
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {similaires.map((m) => (
                                <MagasinCard key={m.id} magasin={m}/>
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

function hostnameOf(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

function instagramUrl(handle: string): string {
    if (handle.startsWith("http")) return handle;
    return `https://instagram.com/${handle.replace(/^@/, "")}`;
}