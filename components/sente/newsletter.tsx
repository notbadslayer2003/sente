"use client";

import { useState } from "react";

export function Newsletter() {
    const [email, setEmail] = useState("");
    const [frequency, setFrequency] = useState<"mensuel" | "hebdo">("mensuel");
    const [submitted, setSubmitted] = useState(false);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: brancher Resend quand la phase backend démarre
        setSubmitted(true);
    };

    return (
        <section className="bg-secondary/40 py-24 sm:py-32 border-t border-border">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12 text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    La lettre Sente
                </p>
                <h2 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight leading-[1.05]">
                    Le territoire, dans votre boîte mail.
                </h2>
                <p className="mt-6 text-muted-foreground text-base sm:text-lg leading-relaxed">
                    Nouveaux étangs partenaires, événements à venir, deals matos chez nos
                    magasins. Rien d&apos;automatique — chaque envoi est lu et écrit par
                    nous.
                </p>

                {submitted ? (
                    <p className="mt-12 text-base text-primary font-medium">
                        Merci. À très vite dans votre boîte.
                    </p>
                ) : (
                    <form onSubmit={onSubmit} className="mt-12 space-y-4">
                        <div className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto">
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="vous@email.be"
                                className="flex-1 bg-background border border-border px-4 py-3.5 text-sm focus:outline-none focus:border-accent transition-colors"
                            />
                            <button
                                type="submit"
                                className="bg-accent text-accent-foreground px-7 py-3.5 text-sm font-medium tracking-wide uppercase hover:bg-accent/90 transition-colors"
                            >
                                S&apos;inscrire
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
                            <FreqRadio
                                value="mensuel"
                                label="Mensuel"
                                checked={frequency === "mensuel"}
                                onChange={setFrequency}
                            />
                            <FreqRadio
                                value="hebdo"
                                label="Hebdomadaire"
                                checked={frequency === "hebdo"}
                                onChange={setFrequency}
                            />
                        </div>

                        <p className="pt-4 text-xs text-muted-foreground">
                            Désinscription en un clic. Conforme RGPD.
                        </p>
                    </form>
                )}
            </div>
        </section>
    );
}

function FreqRadio({
                       value,
                       label,
                       checked,
                       onChange,
                   }: {
    value: "mensuel" | "hebdo";
    label: string;
    checked: boolean;
    onChange: (v: "mensuel" | "hebdo") => void;
}) {
    return (
        <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
                type="radio"
                name="frequency"
                value={value}
                checked={checked}
                onChange={() => onChange(value)}
                className="accent-[var(--accent)]"
            />
            <span className="uppercase tracking-wide">{label}</span>
        </label>
    );
}