import { Eyebrow } from "./eyebrow";

// ============================================================
// Founder
//
// Port du <Founder /> du design Claude (sente.jsx).
//
// Section "Pourquoi Sente" :
// - Gauche : portrait Maxime, fond image avec gradient bas + nom
// - Droite : citation forte + 3 paragraphes pitch + stats 3 colonnes
//
// Typo : tout en font-body (Inter Tight) avec graisses adaptées —
// le design utilisait Libre Caslon (serif) pour les titres mais on
// reste sur Inter Tight pour la cohérence.
// ============================================================

const STATS = [
    { value: "2024",  label: "Première ligne de code" },
    { value: "2",     label: "Cofondateurs pêcheurs" },
    { value: "100 %", label: "Indépendant, sans levée" },
];

export function Founder() {
    return (
        <section className="bg-warm px-6 py-20 md:px-14 md:py-30">
            <div
                className="grid gap-12 md:gap-[72px] items-center
                   max-w-[1280px] mx-auto
                   grid-cols-1 md:grid-cols-[0.9fr_1.1fr]"
            >
                {/* ===== Colonne gauche : portrait ===== */}
                <div
                    className="relative aspect-[4/5] rounded-md overflow-hidden bg-cover"
                    style={{
                        backgroundImage: "url('/images/img1Sente.webp')",
                        backgroundPosition: "center 30%",
                    }}
                >
                    {/* Gradient bas (transparent → noir 45%) pour lisibilité du nom */}
                    <div
                        aria-hidden="true"
                        className="absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.45))",
                        }}
                    />

                    {/* Nom + sous-titre en bas */}
                    <div className="absolute left-6 right-6 bottom-6 text-white">
                        <div className="font-body font-medium text-[22px] leading-[1.2] tracking-[-0.01em]">
                            Maxime Doutrelepont
                        </div>
                        <div className="font-body text-xs text-white/80 mt-1 uppercase tracking-[0.08em]">
                            Fondateur · Rochefort, Belgique
                        </div>
                    </div>
                </div>

                {/* ===== Colonne droite : citation + pitch + stats ===== */}
                <div>
                    <Eyebrow className="mb-[18px]">Pourquoi Sente</Eyebrow>

                    {/* Citation : le poids visuel du design (52px serif normal) se rend
              bien en font-body medium — plus léger ce serait trop discret pour
              un h2 de cette taille. */}
                    <h2
                        className="font-body font-medium m-0
                       text-3xl md:text-[52px]
                       leading-[1.05] tracking-[-0.025em] text-ink"
                    >
                        « J&apos;ai grandi avec une canne dans les mains. Pas avec dix
                        onglets ouverts pour trouver un moulinet. »
                    </h2>

                    {/* 3 paragraphes pitch */}
                    <div className="font-body text-base leading-[1.7] text-body-ink mt-7 flex flex-col gap-3.5 max-w-[580px]">
                        <p className="m-0">
                            Sente est né d&apos;une frustration simple : il n&apos;existe pas,
                            en Belgique francophone, d&apos;endroit unique pour acheter du
                            matériel de pêche d&apos;occasion, trouver un étang correct, ou
                            contacter le magasin du coin.
                        </p>
                        <p className="m-0">
                            Tout est éclaté sur Facebook, sur 2ememain, sur des forums fermés
                            depuis 2008. Le résultat : on perd du temps, on se fait arnaquer,
                            on rate des spots géniaux à 20 km de chez soi.
                        </p>
                        <p className="m-0">
                            Sente, c&apos;est le toit qu&apos;on n&apos;a jamais eu. On
                            commence par le marketplace parce que c&apos;est ce qui manque
                            le plus. On élargit ensuite aux étangs et aux magasins —
                            vraiment, pas pour la forme.
                        </p>
                    </div>

                    {/* Stats : border-top + 3 colonnes */}
                    <div
                        className="mt-8 pt-6 border-t border-line
                       flex flex-wrap gap-9
                       font-body text-[13px] text-body-ink"
                    >
                        {STATS.map((stat) => (
                            <div key={stat.label}>
                                {/* font-medium pour les chiffres : assez fort sans devenir bold
                    bruyant. Le strong natif HTML est bold (700) par défaut,
                    donc on override. */}
                                <strong className="font-body font-medium text-2xl text-ink not-italic block">
                                    {stat.value}
                                </strong>
                                <div className="text-mute mt-0.5">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}