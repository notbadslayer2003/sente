"use client";

import * as React from "react";
import { Eyebrow } from "./eyebrow";
import { ButtonSente } from "./button-sente";

// ============================================================
// VisionWaitlistForm
//
// Form interactif de la section Vision.
//
// État local :
// - audience : "etang" | "magasin" — toggle visuel des fields
// - submitted : boolean — bascule sur l'écran de confirmation
//
// IMPORTANT — TODO PERSISTANCE :
// Le design Claude fait juste `setSubmitted(true)` sans persister.
// On porte ce comportement à l'identique mais ça n'enregistre RIEN
// pour l'instant. À brancher quand la table `waitlist_signups`
// existera dans le schema Supabase. Plan :
//   1. Migration 0003 : table waitlist_signups(id, audience, name,
//      city, email, created_at, ip_hash, user_agent)
//   2. RLS : INSERT permis à anonymous, SELECT réservé à app_admins
//   3. Server Action submitWaitlist(formData) avec validation Zod
//   4. Rate limit Upstash (auth:<ip>) pour éviter spam
//   5. Email confirmation via Resend
//
// Pour l'instant : pas de Sentry log non plus pour éviter de
// faire croire que la donnée est sauvée.
// ============================================================

type Audience = "etang" | "magasin";

const AUDIENCES: Record<
    Audience,
    { label: string; fields: { name: string; placeholder: string; type?: string }[] }
> = {
    etang: {
        label: "Je gère un étang",
        fields: [
            { name: "venue_name", placeholder: "Nom de l'étang" },
            { name: "city",       placeholder: "Ville" },
            { name: "email",      placeholder: "Email", type: "email" },
        ],
    },
    magasin: {
        label: "Je tiens un magasin",
        fields: [
            { name: "venue_name", placeholder: "Nom du magasin" },
            { name: "city",       placeholder: "Ville" },
            { name: "email",      placeholder: "Email", type: "email" },
        ],
    },
};

export function VisionWaitlistForm() {
    const [audience, setAudience] = React.useState<Audience>("etang");
    const [submitted, setSubmitted] = React.useState(false);

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        // TODO : remplacer par une Server Action submitWaitlist(formData)
        // qui valide via Zod et insère dans waitlist_signups.
        setSubmitted(true);
    }

    return (
        <div className="bg-white text-ink rounded-lg p-7 md:p-9">
            {submitted ? (
                <ConfirmationView audience={audience} />
            ) : (
                <form onSubmit={handleSubmit}>
                    <Eyebrow className="mb-3.5">Waitlist · Étangs &amp; Magasins</Eyebrow>

                    <h3 className="font-body font-medium m-0 text-[28px]">
                        Sois parmi les premiers à référencer ton lieu.
                    </h3>

                    <p className="font-body text-[13px] text-body-ink leading-[1.55] mt-3">
                        Réservé aux propriétaires d&apos;étang et gérants de magasin.
                        Onboarding gratuit, 3 mois offerts au lancement.
                    </p>

                    {/* ----- Toggle audience ----- */}
                    <div
                        role="tablist"
                        aria-label="Type de structure"
                        className="flex gap-1.5 mt-6 p-1 bg-paper rounded-full"
                    >
                        {(Object.entries(AUDIENCES) as [Audience, typeof AUDIENCES.etang][]).map(
                            ([key, value]) => {
                                const isActive = audience === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => setAudience(key)}
                                        className={[
                                            "flex-1 px-3.5 py-2.5 rounded-full border-0 cursor-pointer",
                                            "font-body text-[13px] font-medium",
                                            "transition-colors duration-200",
                                            isActive
                                                ? "bg-ink text-white"
                                                : "bg-transparent text-body-ink hover:text-ink",
                                        ].join(" ")}
                                    >
                                        {value.label}
                                    </button>
                                );
                            }
                        )}
                    </div>

                    {/* ----- Fields dynamiques selon audience ----- */}
                    <div className="flex flex-col gap-3 mt-[22px]">
                        {AUDIENCES[audience].fields.map((field) => (
                            <input
                                key={field.name}
                                name={field.name}
                                type={field.type ?? "text"}
                                placeholder={field.placeholder}
                                aria-label={field.placeholder}
                                maxLength={120}
                                required
                                className="font-body text-sm
                           px-4 py-3 rounded-md
                           bg-paper border border-line
                           text-ink placeholder:text-mute
                           outline-none
                           focus:border-ink focus:ring-1 focus:ring-ink/10
                           transition-colors duration-200"
                            />
                        ))}
                    </div>

                    <ButtonSente
                        kind="green"
                        size="lg"
                        type="submit"
                        className="w-full justify-center mt-[18px]"
                    >
                        Rejoindre la waitlist
                    </ButtonSente>

                    <p className="font-body text-[11px] text-mute text-center mt-3">
                        184 étangs · 96 magasins déjà inscrits
                    </p>
                </form>
            )}
        </div>
    );
}

// ------------------------------------------------------------
// Vue confirmation post-submit
// ------------------------------------------------------------

function ConfirmationView({ audience }: { audience: Audience }) {
    const label = audience === "etang" ? "Étangs" : "Magasins";

    return (
        <div className="text-center py-8 px-4">
            <div className="w-14 h-14 rounded-full bg-green-l text-green-d
                      grid place-items-center mx-auto mb-5">
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M 4 12 L 9 17 L 20 6" />
                </svg>
            </div>

            <h3 className="font-body font-medium m-0 text-[28px]">
                On t&apos;a noté.
            </h3>

            <p className="font-body text-sm text-body-ink leading-[1.55] mt-3">
                On revient vers toi dès que la bêta {label} ouvre. Pas de spam, promis.
            </p>
        </div>
    );
}