"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMyOrganization } from "@/app/actions/organizations";

type OrgType = "etang" | "magasin";

export function OrgSignupForm({ type }: { type: OrgType }) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isPending, startTransition] = useTransition();

    function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("orgType", type);

        setError(null);
        setFieldErrors({});

        startTransition(async () => {
            const result = await createMyOrganization(formData);
            if (!result.ok) {
                setError(result.error);
                setFieldErrors(result.fieldErrors ?? {});
                return;
            }
            // Redirige vers le dashboard de la nouvelle org pour qu'il complète
            router.push(`/dashboard/${result.slug}`);
        });
    }

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            <Field
                label={type === "etang" ? "Nom de l'étang" : "Nom du magasin"}
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
                {isPending ? "Création..." : "Créer mon organisation"}
            </button>

            <p className="text-xs text-muted-foreground leading-relaxed pt-2">
                Tu pourras compléter les détails (adresse, photos, description, tarifs)
                depuis ton tableau de bord. L&apos;organisation sera ensuite soumise à
                validation par l&apos;équipe Sente.
            </p>
        </form>
    );
}

function Field({
                   label,
                   name,
                   required = false,
                   error,
               }: {
    label: string;
    name: string;
    required?: boolean;
    error?: string;
}) {
    return (
        <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {label}
            </span>
            <input
                type="text"
                name={name}
                required={required}
                className={`mt-2 w-full bg-background border px-4 py-3 text-sm focus:outline-none transition-colors ${
                    error
                        ? "border-destructive focus:border-destructive"
                        : "border-border focus:border-accent"
                }`}
            />
            {error && (
                <span className="mt-1.5 text-xs text-destructive block">{error}</span>
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