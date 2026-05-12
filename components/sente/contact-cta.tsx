"use client";

import * as React from "react";
import { Eyebrow } from "./eyebrow";
import { ButtonSente } from "./button-sente";

// ============================================================
// ContactCTA
//
// Port du <ContactCTA /> du design Claude (sente.jsx).
//
// Section "Une question ?" en deux colonnes :
// - Gauche : pitch + email + localisation
// - Droite : card form en 2 étapes
//   Étape 1 : grille 6 boutons (choix du sujet)
//   Étape 2 : email + textarea + bouton "Envoyer"
//   Indicateur de progression en haut (barres + "Étape X / 2")
//
// id="contact" → cible de l'ancre #contact des autres composants
// (notamment du lien "Poser une autre question →" dans la FAQ).
//
// IMPORTANT — TODO PERSISTANCE :
// Le submit n'envoie rien. Mêmes considérations que Vision waitlist :
// à brancher sur une Server Action quand on aura :
//   - table contact_messages(id, topic, email, message, created_at,
//     ip_hash, user_agent, status)
//   - RLS : INSERT pour anon, SELECT pour app_admins
//   - Server Action submitContact() avec Zod + rate limit Upstash
//   - Email Resend vers bonjour@lasente.eu pour notification équipe
//   - Auto-reply via Resend vers l'expéditeur
// ============================================================

type Topic = {
    id: string;
    label: string;
};

const TOPICS: Topic[] = [
    { id: "protect",     label: "Sente Protect & paiement" },
    { id: "shipping",    label: "Livraison ou retour" },
    { id: "account",     label: "Mon compte / vérification" },
    { id: "partnership", label: "Partenariat / waitlist pro" },
    { id: "press",       label: "Presse / média" },
    { id: "other",       label: "Autre" },
];

export function ContactCTA() {
    const [topicId, setTopicId] = React.useState<string>("");
    const [step, setStep] = React.useState<1 | 2>(1);

    function pickTopic(id: string) {
        setTopicId(id);
        setStep(2);
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        // TODO : Server Action submitContactMessage(formData)
        // Pour l'instant : aucun feedback utilisateur (fidèle au design).
        // À améliorer dès qu'on branche : transition vers un état submitted
        // comme Vision waitlist.
    }

    const currentTopic = TOPICS.find((t) => t.id === topicId);

    return (
        <section
            id="contact"
            className="bg-paper px-6 py-20 md:px-14 md:py-30"
        >
            <div
                className="max-w-[1100px] mx-auto
                   grid gap-12 md:gap-16 items-center
                   grid-cols-1 md:grid-cols-[1fr_1.1fr]"
            >
                {/* ===== Colonne gauche : pitch + coordonnées ===== */}
                <div>
                    <Eyebrow className="mb-[18px]">Une question ?</Eyebrow>

                    <h2
                        className="font-body font-medium m-0
                       text-3xl md:text-[56px]
                       leading-[1.04] tracking-[-0.025em] text-ink"
                    >
                        On répond personnellement, sous 24&nbsp;h.
                    </h2>

                    <p className="font-body text-base text-body-ink leading-[1.6] mt-[22px]">
                        Pas de chatbot, pas de ticket numéroté. Deux clics, une question,
                        une vraie réponse écrite par quelqu&apos;un qui pêche.
                    </p>

                    {/* ----- Coordonnées (email + localisation) ----- */}
                    <div className="mt-7 flex flex-col gap-3 font-body text-sm text-body-ink">
                        <a
                            href="mailto:hello@sente.fish"
                            className="inline-flex items-center gap-2.5 no-underline text-body-ink hover:text-ink transition-colors duration-200"
                        >
                            <ContactIconWrapper>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <path d="M 4 7 L 12 13 L 20 7" />
                                    <rect x="3" y="6" width="18" height="14" rx="2" />
                                </svg>
                            </ContactIconWrapper>
                            <span>hello@sente.fish</span>
                        </a>

                        <div className="inline-flex items-center gap-2.5">
                            <ContactIconWrapper>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <circle cx="12" cy="10" r="3" />
                                    <path d="M 12 2 a 8 8 0 0 1 8 8 c 0 6 -8 12 -8 12 s -8 -6 -8 -12 a 8 8 0 0 1 8 -8 Z" />
                                </svg>
                            </ContactIconWrapper>
                            <span>Rochefort, Belgique · Réponse FR/EN</span>
                        </div>
                    </div>
                </div>

                {/* ===== Colonne droite : card form ===== */}
                <div className="bg-white border border-line rounded-lg p-7 md:p-8">
                    {/* ----- Header : progression ----- */}
                    <div className="flex justify-between items-center mb-6">
                        <Eyebrow>Étape {step} / 2</Eyebrow>
                        <div className="flex gap-1.5">
                            <span className="w-6 h-[3px] rounded-full bg-green" />
                            <span
                                className={[
                                    "w-6 h-[3px] rounded-full transition-colors duration-200",
                                    step === 2 ? "bg-green" : "bg-line",
                                ].join(" ")}
                            />
                        </div>
                    </div>

                    {/* ----- Étape 1 : choix du sujet ----- */}
                    {step === 1 && (
                        <>
                            <h3 className="font-body font-medium m-0 text-[26px] tracking-[-0.015em] text-ink">
                                Sur quoi tu veux nous écrire ?
                            </h3>

                            <div className="mt-[22px] grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {TOPICS.map((t) => {
                                    const isActive = topicId === t.id;
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => pickTopic(t.id)}
                                            className={[
                                                "text-left px-4 py-3.5 rounded-md",
                                                "bg-paper border",
                                                "font-body text-sm font-medium text-ink",
                                                "cursor-pointer transition-colors duration-200",
                                                isActive ? "border-ink" : "border-line hover:border-ink",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            ].join(" ")}
                                        >
                      <span className="flex items-center justify-between gap-3">
                        <span>{t.label}</span>
                        <span className="text-mute shrink-0" aria-hidden="true">→</span>
                      </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* ----- Étape 2 : formulaire ----- */}
                    {step === 2 && (
                        <form onSubmit={handleSubmit}>
                            {/* Retour étape 1 */}
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="bg-transparent border-0 p-0 mb-3.5
                           font-body text-xs text-body-ink cursor-pointer
                           hover:text-ink transition-colors duration-200
                           focus-visible:outline-none focus-visible:underline"
                            >
                                ← Changer de sujet
                            </button>

                            <h3 className="font-body font-medium m-0 text-[26px] tracking-[-0.015em] text-ink">
                                Écris-nous.
                            </h3>

                            <p className="font-body text-xs text-mute mt-1.5">
                                Sujet : {currentTopic?.label ?? "—"}
                            </p>

                            <div className="flex flex-col gap-3 mt-[18px]">
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    maxLength={160}
                                    placeholder="Ton email"
                                    aria-label="Email"
                                    className="font-body text-sm
                             px-4 py-3 rounded-md
                             bg-paper border border-line
                             text-ink placeholder:text-mute
                             outline-none
                             focus:border-ink focus:ring-1 focus:ring-ink/10
                             transition-colors duration-200"
                                />
                                <textarea
                                    name="message"
                                    required
                                    maxLength={4000}
                                    rows={5}
                                    placeholder="Dis-nous tout — on lit chaque message."
                                    aria-label="Message"
                                    className="font-body text-sm
                             px-4 py-3 rounded-md
                             bg-paper border border-line
                             text-ink placeholder:text-mute
                             outline-none resize-y
                             focus:border-ink focus:ring-1 focus:ring-ink/10
                             transition-colors duration-200"
                                />
                                {/* Champ caché pour passer le sujet à la Server Action plus tard */}
                                <input type="hidden" name="topic_id" value={topicId} />
                            </div>

                            <ButtonSente
                                kind="green"
                                size="lg"
                                type="submit"
                                className="w-full justify-center mt-[18px]"
                            >
                                Envoyer
                            </ButtonSente>

                            <p className="font-body text-[11px] text-mute text-center mt-3">
                                Réponse personnelle sous 24&nbsp;h ouvrées.
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}

// ------------------------------------------------------------
// Cercle d'icône (réutilisé email + adresse)
// ------------------------------------------------------------

function ContactIconWrapper({ children }: { children: React.ReactNode }) {
    return (
        <span
            aria-hidden="true"
            className="w-9 h-9 rounded-full bg-white border border-line
                 grid place-items-center text-ink shrink-0"
        >
      {children}
    </span>
    );
}