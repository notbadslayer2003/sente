"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions/auth";
import {PasswordField} from "@/components/sente/password-field";

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);

        startTransition(async () => {
            const result = await loginAction(formData);
            // En cas de succès, loginAction redirect() — on n'arrive pas ici.
            if (!result.ok) {
                setError(result.error);
            }
        });
    };

    return (
        <section className="bg-background min-h-screen pt-32 pb-16 flex items-start justify-center">
            <div className="w-full max-w-md mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Connexion
                    </p>
                    <h1 className="mt-3 font-display-soft text-4xl sm:text-5xl tracking-tight leading-[0.95]">
                        Bon retour.
                    </h1>
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                    <Field
                        label="Email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                    />
                    <PasswordField
                        label="Mot de passe"
                        name="password"
                        required
                        autoComplete="current-password"
                    />

                    <div className="text-right">
                        <Link
                            href="/auth/mot-de-passe-oublie"
                            className="text-xs text-muted-foreground hover:text-accent transition-colors uppercase tracking-wide"
                        >
                            Mot de passe oublié ?
                        </Link>
                    </div>

                    {error && (
                        <div className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3.5 text-sm font-medium tracking-wide uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? "Connexion..." : "Se connecter"}
                    </button>
                </form>

                <p className="mt-10 text-center text-sm text-muted-foreground">
                    Pas encore de compte ?{" "}
                    <Link
                        href="/signup"
                        className="text-foreground border-b border-foreground hover:text-accent hover:border-accent transition-colors uppercase tracking-wide text-xs ml-1"
                    >
                        Créer un compte
                    </Link>
                </p>
            </div>
        </section>
    );
}

function Field({
                   label,
                   name,
                   type,
                   required = false,
                   autoComplete,
               }: {
    label: string;
    name: string;
    type: string;
    required?: boolean;
    autoComplete?: string;
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
            <input
                type={type}
                name={name}
                required={required}
                autoComplete={autoComplete}
                className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors"
            />
        </label>
    );
}