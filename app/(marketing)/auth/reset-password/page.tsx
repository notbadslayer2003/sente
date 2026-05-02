"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { resetPasswordAction } from "@/app/actions/auth";

export default function ResetPasswordPage() {
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        setError(null);
        setFieldErrors({});

        startTransition(async () => {
            const result = await resetPasswordAction(formData);
            // En cas de succès, redirect("/profil") — on n'arrive pas ici
            if (!result.ok) {
                setError(result.error);
                setFieldErrors(result.fieldErrors ?? {});
            }
        });
    };

    return (
        <section className="bg-background min-h-screen pt-32 pb-16 flex items-start justify-center">
            <div className="w-full max-w-md mx-auto px-6">
                <div className="text-center mb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Nouveau mot de passe
                    </p>
                    <h1 className="mt-3 font-display-soft text-4xl sm:text-5xl tracking-tight leading-[0.95]">
                        Choisis-en un solide.
                    </h1>
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                    <Field
                        label="Nouveau mot de passe"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        error={fieldErrors.password}
                        hint="8 caractères minimum"
                    />
                    <Field
                        label="Confirmer le mot de passe"
                        name="passwordConfirm"
                        type="password"
                        autoComplete="new-password"
                        required
                        error={fieldErrors.passwordConfirm}
                    />

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
                        {isPending ? "Mise à jour..." : "Mettre à jour mon mot de passe"}
                    </button>
                </form>

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

function Field({
                   label,
                   name,
                   type,
                   required = false,
                   autoComplete,
                   error,
                   hint,
               }: {
    label: string;
    name: string;
    type: string;
    required?: boolean;
    autoComplete?: string;
    error?: string;
    hint?: string;
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
                className={`mt-2 w-full bg-background border px-4 py-3 text-sm focus:outline-none transition-colors ${
                    error
                        ? "border-destructive focus:border-destructive"
                        : "border-border focus:border-accent"
                }`}
            />
            {error && (
                <span className="mt-1.5 text-xs text-destructive block">{error}</span>
            )}
            {!error && hint && (
                <span className="mt-1.5 text-xs text-muted-foreground block">{hint}</span>
            )}
        </label>
    );
}