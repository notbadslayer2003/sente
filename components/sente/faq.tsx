"use client";

import * as React from "react";
import {Eyebrow} from "./eyebrow";

// ============================================================
// FAQ
//
// Port fidèle du <FAQ /> du design Claude (sente.jsx).
//
// Section blanche, grid 2 colonnes :
// - Gauche : eyebrow + h2 + p + lien "Poser une autre question →"
// - Droite : accordéon 5 items, premier item ouvert par défaut
//
// Comportement accordéon :
// - Un seul item ouvert à la fois (state = index ouvert, ou -1 si aucun)
// - Clic sur l'item ouvert → ferme tout
// - Indicateur "+" qui rotate 45° (devient "×" visuellement) à l'ouverture
//
// Note contenu :
// Les questions/réponses sont en dur. Plus tard on peut les déplacer
// dans un fichier de contenu marketing (lib/content/faq.ts) ou en CMS
// si Mathis veut pouvoir éditer sans déploiement.
// ============================================================

type FAQItem = {
    q: string;
    a: string;
};

const FAQ_ITEMS: FAQItem[] = [
    {
        q: "Comment fonctionne Sente Protect ?",
        a: "Quand tu achètes, ton paiement est bloqué chez notre partenaire bancaire (Stripe) — il n'est libéré au vendeur que quand tu confirmes avoir reçu l'article conforme. En cas de litige, on rembourse intégralement sous 14 jours.",
    },
    {
        q: "Y a-t-il des frais ou une commission ?",
        a: "Aucune commission sur la vente. Seul un forfait Sente Protect de 1,20 € par transaction (côté acheteur) couvre l'assurance, le séquestre et le support. Les vendeurs reçoivent 100 % du prix de leur annonce.",
    },
    {
        q: "Qui peut vendre ? Faut-il être pro ?",
        a: "Non. Sente est un marketplace entre particuliers passionnés. Tu crées ton compte vérifié en 2 minutes (email + téléphone) et tu publies. Les vendeurs avec 3 ventes notées passent automatiquement \"vendeur vérifié\".",
    },
    {
        q: "Comment se passe la livraison ?",
        a: "Trois options : Mondial Relay (4,95 €), bpost à domicile (7,50 €) ou remise en main propre. L'étiquette est générée automatiquement après paiement — le vendeur a 3 jours ouvrés pour expédier.",
    },
    {
        q: "Et si je veux annuler ou retourner un article ?",
        a: "Tu as 14 jours après réception pour signaler un problème via l'app — non-conformité, dégradation, descriptif trompeur. Le séquestre Sente Protect te garantit un remboursement intégral si le litige est fondé.",
    },
];

export function FAQ() {
    // Index de l'item ouvert. -1 = aucun ouvert.
    // Premier item ouvert par défaut, comme le design.
    const [openIndex, setOpenIndex] = React.useState<number>(0);

    function toggle(i: number) {
        setOpenIndex((current) => (current === i ? -1 : i));
    }

    return (
        <section className="bg-white px-6 py-20 md:px-14 md:py-30">
            <div
                className="grid gap-12 md:gap-20
                   max-w-[1280px] mx-auto
                   grid-cols-1 md:grid-cols-[0.8fr_1.2fr]"
            >
                {/* ===== Colonne gauche : pitch ===== */}
                <div>
                    <Eyebrow className="mb-4">FAQ · Tout ce qui rassure</Eyebrow>

                    <h2
                        className="font-body font-medium m-0
                       text-3xl md:text-[52px]
                       leading-[1.05] tracking-[-0.025em] text-ink"
                    >
                        Acheter et vendre en toute confiance.
                    </h2>

                    <p className="font-body text-[15px] text-body-ink leading-[1.6] mt-[18px]">
                        Cinq réponses qu&apos;on nous demande tout le temps. Si la tienne
                        n&apos;y est pas, écris-nous — on répond sous 24&nbsp;h.
                    </p>

                    <a
                        href="#contact"
                        className="inline-flex items-center gap-1.5
                       mt-6 pb-1
                       font-body text-sm font-medium text-ink no-underline
                       border-b border-ink
                       hover:text-green hover:border-green
                       transition-colors duration-200"
                    >
                        Poser une autre question
                        <span aria-hidden="true">→</span>
                    </a>
                </div>

                {/* ===== Colonne droite : accordéon ===== */}
                <div
                    role="region"
                    aria-label="Questions fréquentes"
                    className="border-t border-line"
                >
                    {FAQ_ITEMS.map((item, i) => {
                        const isOpen = openIndex === i;
                        const panelId = `faq-panel-${i}`;
                        const buttonId = `faq-button-${i}`;

                        return (
                            <div key={item.q} className="border-b border-line">
                                <button
                                    id={buttonId}
                                    type="button"
                                    onClick={() => toggle(i)}
                                    aria-expanded={isOpen}
                                    aria-controls={panelId}
                                    className="w-full flex justify-between items-center gap-6
                             py-6 px-0
                             bg-transparent border-0 cursor-pointer text-left
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                                >
                  <span
                      className="font-body font-medium text-[22px] leading-[1.3]
                               text-ink"
                  >
                    {item.q}
                  </span>

                                    {/* Indicateur "+" qui rotate 45° → devient "×" */}
                                    <span
                                        aria-hidden="true"
                                        className={[
                                            "shrink-0 w-7 h-7 rounded-full",
                                            "border border-line bg-white",
                                            "grid place-items-center",
                                            "text-sm text-ink leading-none",
                                            "transition-transform duration-200",
                                            isOpen ? "rotate-45" : "",
                                        ].join(" ")}
                                    >
                    +
                  </span>
                                </button>

                                {/* Réponse — affichée uniquement si ouvert
                    fade-up class vient de globals.css */}
                                {isOpen && (
                                    <div
                                        id={panelId}
                                        role="region"
                                        aria-labelledby={buttonId}
                                        className="fade-up
                               pb-6 pr-0 md:pr-[60px]
                               font-body text-[15px] leading-[1.65] text-body-ink"
                                    >
                                        {item.a}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}