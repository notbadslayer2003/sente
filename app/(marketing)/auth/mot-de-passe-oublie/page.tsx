"use client";

import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import { forgotPasswordAction } from "@/app/actions/auth";

const COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
    const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [cooldown, setCooldown] = useState(0);

    // Tick du cooldown chaque seconde
    useEffect(() => {
        if (cooldown <= 0) return;
        const id = setInterval(() => {
            setCooldown((c) => Math.max(0, c - 1));
        }, 1000);
        return () => clearInterval(id);
    }, [cooldown]);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (cooldown > 0) return;
        setError(null);

        const formData = new FormData(e.currentTarget);
        const email = (formData.get("email") as string)?.trim();

        if (!email) {
            setError("Entre ton email.");
            return;
        }

        startTransition(async () => {
            try {
                const r = await forgotPasswordAction(formData);
                if (r.ok) {
                    setSubmittedEmail(email);
                    setCooldown(COOLDOWN_SECONDS);
                } else {
                    setError(r.error);
                }
            } catch (err) {
                console.error("forgotPasswordAction failed:", err);
                setError("Une erreur est survenue. Réessaie dans un instant.");
            }
        });
    };

    const onUseDifferentEmail = () => {
        setSubmittedEmail(null);
        setError(null);
        // Note : on garde le cooldown actif. Si l'utilisateur veut spammer
        // d'autres emails, il devra attendre la fin du cooldown.
    };

    return (
        <section className="bg-background min-h-screen pt-32 pb-16 flex items-start justify-center">
            <div className="w-full max-w-md mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Mot de passe oublié
                    </p>
                    <h1 className="mt-3 font-display-soft text-4xl sm:text-5xl tracking-tight leading-[0.95]">
                        {submittedEmail ? "Vérifie ta boîte mail." : "Pas de panique."}
                    </h1>
                </div>

                {submittedEmail ? (
                    <>
                        <div className="border border-border bg-secondary/30 p-8">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Si un compte existe pour{" "}
                                <span className="font-medium text-foreground">
                                    {submittedEmail}
                                </span>
                                , un email avec un lien de réinitialisation vient
                                d&apos;être envoyé. Pense à vérifier tes spams.
                            </p>
                            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                                Le lien est valide 1 heure.
                            </p>
                            {cooldown > 0 && (
                                <p className="mt-4 text-xs text-muted-foreground">
                                    Tu pourras renvoyer un nouveau lien dans{" "}
                                    <span className="font-medium tabular-nums">
                                        {cooldown}s
                                    </span>
                                    .
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onUseDifferentEmail}
                            disabled={cooldown > 0}
                            className="mt-6 mx-auto block text-xs uppercase tracking-wide text-muted-foreground hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
                        >
                            {cooldown > 0
                                ? `Patiente ${cooldown}s avant de réessayer`
                                : "Utiliser un autre email"}
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground text-center mb-8">
                            Entre ton email, on t&apos;envoie un lien pour choisir un
                            nouveau mot de passe.
                        </p>
                        <form onSubmit={onSubmit} className="space-y-5">
                            <label className="block">
                                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                                    Email
                                </span>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    autoComplete="email"
                                    disabled={isPending || cooldown > 0}
                                    className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors disabled:opacity-50"
                                />
                            </label>

                            {error && (
                                <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isPending || cooldown > 0}
                                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3.5 text-sm font-medium tracking-wide uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending
                                    ? "Envoi..."
                                    : cooldown > 0
                                        ? `Réessaie dans ${cooldown}s`
                                        : "Envoyer le lien"}
                            </button>
                        </form>
                    </>
                )}

                <p className="mt-10 text-center text-sm text-muted-foreground">
                    <Link
                        href="/login"
                        className="text-foreground border-b border-foreground hover:text-accent hover:border-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        ← Retour à la connexion
                    </Link>
                </p>
            </div>
        </section>
    );
}