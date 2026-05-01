"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Fish, Waves, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Role = "pecheur" | "etang" | "magasin";

export default function SignupPage() {
    return (
        <Suspense fallback={null}>
            <SignupInner />
        </Suspense>
    );
}

function SignupInner() {
    const searchParams = useSearchParams();
    const initialRole = (searchParams.get("role") as Role) || null;
    const [role, setRole] = useState<Role | null>(initialRole);
    const [submitted, setSubmitted] = useState(false);

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: brancher Supabase Auth + création organization si etang/magasin
        setSubmitted(true);
    };

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                <div className="text-center mb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Créer un compte
                    </p>
                    <h1 className="mt-3 font-display-soft text-4xl sm:text-5xl tracking-tight leading-[0.95]">
                        {role
                            ? "Quelques infos et c'est parti."
                            : "Vous êtes…"}
                    </h1>
                </div>

                {!role ? (
                    <RoleSelector onSelect={setRole} />
                ) : submitted ? (
                    <div className="border border-border bg-secondary/30 p-8 text-center max-w-lg mx-auto">
                        <p className="font-display text-2xl">Merci.</p>
                        <p className="mt-3 text-sm text-muted-foreground">
                            La création de compte sera active dès la mise en place de
                            l&apos;authentification (Supabase). Vous serez parmi les
                            premiers prévenus.
                        </p>
                    </div>
                ) : (
                    <SignupForm role={role} onChangeRole={() => setRole(null)} onSubmit={onSubmit} />
                )}

                <p className="mt-10 text-center text-sm text-muted-foreground">
                    Déjà un compte ?{" "}
                    <Link
                        href="/login"
                        className="text-foreground border-b border-foreground hover:text-accent hover:border-accent transition-colors uppercase tracking-wide text-xs ml-1"
                    >
                        Se connecter
                    </Link>
                </p>
            </div>
        </section>
    );
}

function RoleSelector({ onSelect }: { onSelect: (r: Role) => void }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border border border-border max-w-3xl mx-auto">
            <RoleCard
                icon={Fish}
                label="Pêcheur"
                description="Trouver des étangs, acheter du matos, suivre la communauté."
                onClick={() => onSelect("pecheur")}
            />
            <RoleCard
                icon={Waves}
                label="Étang"
                description="Listing gratuit, posts, événements. Dashboard CRM en option."
                onClick={() => onSelect("etang")}
                highlight
            />
            <RoleCard
                icon={Store}
                label="Magasin"
                description="Listing gratuit, posts. Boutique en ligne intégrée."
                onClick={() => onSelect("magasin")}
            />
        </div>
    );
}

function RoleCard({
                      icon: Icon,
                      label,
                      description,
                      onClick,
                      highlight = false,
                  }: {
    icon: LucideIcon;
    label: string;
    description: string;
    onClick: () => void;
    highlight?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            className={`p-8 text-left flex flex-col gap-4 transition-colors ${
                highlight ? "bg-secondary/40" : "bg-background"
            } hover:bg-accent/5`}
        >
            <div className="w-10 h-10 flex items-center justify-center bg-accent/10 text-accent">
                <Icon className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <p className="font-display text-2xl tracking-tight">{label}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
            </p>
            <span className="mt-auto text-xs uppercase tracking-wide border-b border-foreground self-start pb-0.5">
        Choisir →
      </span>
        </button>
    );
}

function SignupForm({
                        role,
                        onChangeRole,
                        onSubmit,
                    }: {
    role: Role;
    onChangeRole: () => void;
    onSubmit: (e: React.FormEvent) => void;
}) {
    return (
        <div className="max-w-lg mx-auto">
            <div className="mb-8 flex items-center justify-between gap-4 border border-border bg-secondary/30 px-5 py-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Type de compte
                    </p>
                    <p className="font-display text-lg leading-tight mt-1">
                        {role === "pecheur" && "Pêcheur"}
                        {role === "etang" && "Étang"}
                        {role === "magasin" && "Magasin"}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onChangeRole}
                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                >
                    Changer
                </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
                {role !== "pecheur" && (
                    <Field
                        label={role === "etang" ? "Nom de l'étang" : "Nom du magasin"}
                        name="orgName"
                        required
                    />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field
                        label="Prénom"
                        name="firstName"
                        required
                        autoComplete="given-name"
                    />
                    <Field
                        label="Nom"
                        name="lastName"
                        required
                        autoComplete="family-name"
                    />
                </div>

                <Field
                    label="Email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                />
                <Field
                    label="Mot de passe"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                />

                <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer pt-2">
                    <input
                        type="checkbox"
                        required
                        className="mt-1 accent-[var(--accent)]"
                    />
                    <span>
            J&apos;accepte les{" "}
                        <Link
                            href="/cgu"
                            className="text-foreground hover:text-accent transition-colors underline underline-offset-4"
                        >
              CGU
            </Link>{" "}
                        et la{" "}
                        <Link
                            href="/confidentialite"
                            className="text-foreground hover:text-accent transition-colors underline underline-offset-4"
                        >
              politique de confidentialité
            </Link>
            .
          </span>
                </label>

                <button
                    type="submit"
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3.5 text-sm font-medium tracking-wide uppercase"
                >
                    Créer mon compte
                </button>
            </form>
        </div>
    );
}

function Field({
                   label,
                   name,
                   type = "text",
                   required = false,
                   autoComplete,
               }: {
    label: string;
    name: string;
    type?: string;
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