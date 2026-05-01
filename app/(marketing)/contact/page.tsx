"use client";

import { useState } from "react";

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: brancher Resend ou un endpoint /api/contact quand backend prêt
        setSubmitted(true);
    };

    return (
        <>
            <section className="bg-background pt-32 pb-12 sm:pt-40 sm:pb-16 border-b border-border">
                <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Contact
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl sm:text-6xl tracking-tight leading-[0.95]">
                        Une question, un projet ?
                    </h1>
                    <p className="mt-6 text-muted-foreground text-base sm:text-lg leading-relaxed">
                        Pour devenir partenaire, suggérer un étang ou un magasin, ou
                        simplement nous écrire — on lit tout, on répond vite.
                    </p>
                </div>
            </section>

            <section className="bg-background py-16 sm:py-24">
                <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                    {submitted ? (
                        <div className="border border-border bg-secondary/30 p-12 text-center">
                            <p className="font-display text-3xl">Merci.</p>
                            <p className="mt-3 text-muted-foreground">
                                Votre message est arrivé. Nous revenons vers vous sous 48 h.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={onSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <Field label="Prénom" name="prenom" required />
                                <Field label="Nom" name="nom" required />
                            </div>
                            <Field label="Email" name="email" type="email" required />
                            <SelectField
                                label="Vous êtes…"
                                name="role"
                                required
                                options={[
                                    { value: "", label: "Sélectionner" },
                                    { value: "pecheur", label: "Un pêcheur" },
                                    { value: "etang", label: "Un gestionnaire d'étang" },
                                    { value: "magasin", label: "Un magasin" },
                                    { value: "autre", label: "Autre" },
                                ]}
                            />
                            <TextareaField
                                label="Votre message"
                                name="message"
                                rows={6}
                                required
                            />

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-8 py-3.5 text-sm font-medium tracking-wide uppercase"
                                >
                                    Envoyer
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </section>
        </>
    );
}

function Field({
                   label,
                   name,
                   type = "text",
                   required = false,
               }: {
    label: string;
    name: string;
    type?: string;
    required?: boolean;
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
          {required && " *"}
      </span>
            <input
                type={type}
                name={name}
                required={required}
                className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors"
            />
        </label>
    );
}

function SelectField({
                         label,
                         name,
                         options,
                         required = false,
                     }: {
    label: string;
    name: string;
    options: { value: string; label: string }[];
    required?: boolean;
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
          {required && " *"}
      </span>
            <select
                name={name}
                required={required}
                defaultValue=""
                className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors cursor-pointer"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function TextareaField({
                           label,
                           name,
                           rows,
                           required = false,
                       }: {
    label: string;
    name: string;
    rows: number;
    required?: boolean;
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
          {required && " *"}
      </span>
            <textarea
                name={name}
                rows={rows}
                required={required}
                className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors resize-y"
            />
        </label>
    );
}