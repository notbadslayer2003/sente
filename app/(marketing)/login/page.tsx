"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: brancher Supabase Auth
        setSubmitted(true);
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

                {submitted ? (
                    <div className="border border-border bg-secondary/30 p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Authentification non encore branchée. Cette page sera connectée
                            lors de la mise en place de Supabase.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={onSubmit} className="space-y-5">
                        <Field
                            label="Email"
                            type="email"
                            value={email}
                            onChange={setEmail}
                            required
                        />
                        <Field
                            label="Mot de passe"
                            type="password"
                            value={password}
                            onChange={setPassword}
                            required
                        />

                        <div className="text-right">
                            <Link
                                href="/mot-de-passe-oublie"
                                className="text-xs text-muted-foreground hover:text-accent transition-colors uppercase tracking-wide"
                            >
                                Mot de passe oublié ?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3.5 text-sm font-medium tracking-wide uppercase"
                        >
                            Se connecter
                        </button>
                    </form>
                )}

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
                   type,
                   value,
                   onChange,
                   required = false,
               }: {
    label: string;
    type: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors"
            />
        </label>
    );
}