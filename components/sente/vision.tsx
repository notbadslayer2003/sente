import { Eyebrow } from "./eyebrow";
import { VisionWaitlistForm } from "./vision-waitlist-form";

// ============================================================
// Vision
//
// Port fidèle du <Vision /> du design Claude (sente.jsx).
//
// Section sombre avec :
// - Background image grisée + gradient sombre
// - Grid 2 colonnes : à gauche le pitch (eyebrow + h2 + p + timeline)
//   à droite la waitlist form (composant client séparé)
//
// L'ancre #waitlist sert de cible aux CTA "Rejoindre la waitlist" des
// cards ThreeUses — c'est pour ça qu'on met id="waitlist" sur la section.
//
// Côté gauche 100% statique → Server Component.
// Côté droit (form + state) → Client Component séparé.
// ============================================================

const TIMELINE = [
    { period: "Q3 2026", label: "Étangs · bêta privée" },
    { period: "Q4 2026", label: "Magasins · bêta privée" },
    { period: "2027",    label: "Ouverture publique" },
];

export function Vision() {
    return (
        <section
            id="waitlist"
            className="relative overflow-hidden bg-ink text-white px-6 py-20 md:px-14 md:py-30"
        >
            {/* ----- Background image (grise, opacité 18%) ----- */}
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-cover bg-center"
                style={{
                    backgroundImage: "url('/images/img3Sente.webp')",
                    opacity: 0.18,
                    filter: "grayscale(0.4)",
                }}
            />

            {/* ----- Gradient overlay (presque opaque) ----- */}
            <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(180deg, rgba(10,10,10,0.86) 0%, rgba(10,10,10,0.94) 100%)",
                }}
            />

            {/* ----- Content ----- */}
            <div
                className="relative grid gap-12 md:gap-20 items-center
                   max-w-[1320px] mx-auto
                   grid-cols-1 md:grid-cols-[1.15fr_1fr]"
            >
                {/* ===== Colonne gauche : pitch + timeline ===== */}
                <div>
                    <Eyebrow variant="light" className="mb-[18px] text-white/65">
                        Ce que Sente va devenir
                    </Eyebrow>

                    <h2
                        className="font-body font-medium m-0
                       text-[clamp(2.25rem,5.5vw,4rem)]
                       leading-[1.04] tracking-[-0.025em]"
                    >
                        Le premier marketplace dédié à la pêche. Puis une vitrine pour les
                        étangs et les magasins.
                    </h2>

                    <p className="font-body text-[17px] text-white/[0.72] leading-[1.6] mt-6 max-w-[580px]">
                        Aujourd&apos;hui, on lance le marketplace. Bientôt, Sente devient
                        aussi la carte des étangs de Wallonie et de France, et l&apos;annuaire
                        des magasins indépendants — toutes les infos qui manquent quand on
                        cherche un spot, un magasin, du conseil.
                    </p>

                    {/* ----- Timeline (3 jalons) ----- */}
                    <div
                        className="flex flex-wrap gap-7 mt-9 pt-7
                       border-t border-white/[0.14]"
                    >
                        {TIMELINE.map((item) => (
                            <div key={item.label}>
                                <div className="font-body text-[11px] uppercase tracking-[0.14em] text-white/50 mb-1.5">
                                    {item.period}
                                </div>
                                <div className="font-body font-medium text-lg text-white leading-[1.3]">
                                    {item.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ===== Colonne droite : waitlist form ===== */}
                <VisionWaitlistForm />
            </div>
        </section>
    );
}