"use client";

import Link from "next/link";
import { Suspense, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Fish, Waves, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { signupAction } from "@/app/actions/auth";

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
    const [success, setSuccess] = useState(false);
    const [submittedEmail, setSubmittedEmail] = useState("");

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                <div className="text-center mb-12">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Créer un compte
                    </p>
                    <h1 className="mt-3 font-display-soft text-4xl sm:text-5xl tracking-tight leading-[0.95]">
                        {success
                            ? "Vérifie ta boîte mail."
                            : role
                                ? "Quelques infos et c'est parti."
                                : "Vous êtes…"}
                    </h1>
                </div>

                {success ? (
                    <SuccessPanel email={submittedEmail} />
                ) : !role ? (
                    <RoleSelector onSelect={setRole} />
                ) : (
                    <SignupForm
                        role={role}
                        onChangeRole={() => setRole(null)}
                        onSuccess={(email) => {
                            setSubmittedEmail(email);
                            setSuccess(true);
                        }}
                    />
                )}

                {!success && (
                    <p className="mt-10 text-center text-sm text-muted-foreground">
                        Déjà un compte ?{" "}
                        <Link
                            href="/login"
                            className="text-foreground border-b border-foreground hover:text-accent hover:border-accent transition-colors uppercase tracking-wide text-xs ml-1"
                        >
                            Se connecter
                        </Link>
                    </p>
                )}
            </div>
        </section>
    );
}

function SuccessPanel({ email }: { email: string }) {
    return (
        <div className="border border-border bg-secondary/30 p-8 max-w-lg mx-auto">
            <p className="text-sm text-muted-foreground leading-relaxed">
                Un email de confirmation vient d&apos;être envoyé à{" "}
                <span className="font-medium text-foreground">{email}</span>.
            </p>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Clique sur le lien dans l&apos;email pour activer ton compte. Pense à
                vérifier tes spams.
            </p>
        </div>
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
                        onSuccess,
                    }: {
    role: Role;
    onChangeRole: () => void;
    onSuccess: (email: string) => void;
}) {
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("role", role);
        const email = formData.get("email") as string;

        setError(null);
        setFieldErrors({});

        startTransition(async () => {
            const result = await signupAction(formData);
            if (result.ok) {
                onSuccess(email);
            } else {
                setError(result.error);
                setFieldErrors(result.fieldErrors ?? {});
            }
        });
    };

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
                    <>
                        <Field
                            label={role === "etang" ? "Nom de l'étang" : "Nom du magasin"}
                            name="orgName"
                            required
                            error={fieldErrors.orgName}
                        />
                        <SelectField
                            label="Pays"
                            name="orgCountry"
                            required
                            error={fieldErrors.orgCountry}
                            options={[
                                { value: "", label: "Sélectionner" },
                                { value: "BE", label: "Belgique (Wallonie)" },
                                { value: "FR", label: "France" },
                            ]}
                        />
                    </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field
                        label="Prénom"
                        name="firstName"
                        required
                        autoComplete="given-name"
                        error={fieldErrors.firstName}
                    />
                    <Field
                        label="Nom"
                        name="lastName"
                        required
                        autoComplete="family-name"
                        error={fieldErrors.lastName}
                    />
                </div>

                <Field
                    label="Email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    error={fieldErrors.email}
                />
                <Field
                    label="Mot de passe"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    error={fieldErrors.password}
                    hint="8 caractères minimum"
                />

                <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer pt-2">
                    <input
                        type="checkbox"
                        name="consentTos"
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
                    {isPending ? "Création..." : "Créer mon compte"}
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
                   error,
                   hint,
               }: {
    label: string;
    name: string;
    type?: string;
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

function SelectField({
                         label,
                         name,
                         required = false,
                         error,
                         options,
                     }: {
    label: string;
    name: string;
    required?: boolean;
    error?: string;
    options: { value: string; label: string }[];
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
            <select
                name={name}
                required={required}
                defaultValue=""
                className={`mt-2 w-full bg-background border px-4 py-3 text-sm focus:outline-none transition-colors cursor-pointer ${
                    error
                        ? "border-destructive focus:border-destructive"
                        : "border-border focus:border-accent"
                }`}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            {error && (
                <span className="mt-1.5 text-xs text-destructive block">{error}</span>
            )}
        </label>
    );
}