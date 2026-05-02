"use client";

import { useState, useTransition } from "react";
import { updateOrgFicheAction } from "@/app/actions/org";
import { getRegionsForCountry, type CountryCode } from "@/lib/constants/regions";

type OrgFields = {
    id: string;
    name: string;
    baseline: string;
    description: string;
    country: CountryCode;
    region: string;
    city: string;
    postal_code: string;
    address: string;
    lat: string;
    lng: string;
    contact_email: string;
    contact_phone: string;
    website: string;
    social_facebook: string;
    social_instagram: string;
};

export function FicheForm({ org }: { org: OrgFields }) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isPending, startTransition] = useTransition();

    const regions = getRegionsForCountry(org.country);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("org_id", org.id);
        setError(null);
        setSuccess(false);
        setFieldErrors({});

        startTransition(async () => {
            const result = await updateOrgFicheAction(formData);
            if (result.ok) {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 4000);
            } else {
                setError(result.error);
                setFieldErrors(result.fieldErrors ?? {});
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-12">
            {/* SECTION : Présentation */}
            <Section
                title="Présentation"
                description="Le nom et la description visibles publiquement."
            >
                <Field
                    label="Nom"
                    name="name"
                    defaultValue={org.name}
                    required
                    error={fieldErrors.name}
                />
                <Field
                    label="Accroche"
                    name="baseline"
                    defaultValue={org.baseline}
                    hint="Une phrase courte (max 120 caractères)"
                    error={fieldErrors.baseline}
                />
                <Textarea
                    label="Description"
                    name="description"
                    defaultValue={org.description}
                    rows={6}
                    hint="50 caractères minimum pour publier la fiche"
                    error={fieldErrors.description}
                />
            </Section>

            {/* SECTION : Localisation */}
            <Section
                title="Localisation"
                description={`Pays fixé à la création (${
                    org.country === "BE" ? "Belgique" : "France"
                }). Si erreur, contacte le support.`}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <SelectField
                        label="Région"
                        name="region"
                        defaultValue={org.region}
                        options={[
                            { value: "", label: "Sélectionner" },
                            ...regions.map((r) => ({ value: r.value, label: r.label })),
                        ]}
                        error={fieldErrors.region}
                    />
                    <Field
                        label="Ville"
                        name="city"
                        defaultValue={org.city}
                        error={fieldErrors.city}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <Field
                        label="Code postal"
                        name="postal_code"
                        defaultValue={org.postal_code}
                        error={fieldErrors.postal_code}
                    />
                    <div className="sm:col-span-2">
                        <Field
                            label="Adresse"
                            name="address"
                            defaultValue={org.address}
                            error={fieldErrors.address}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field
                        label="Latitude"
                        name="lat"
                        defaultValue={org.lat}
                        type="number"
                        step="any"
                        hint="Ex: 50.4504"
                        error={fieldErrors.lat}
                    />
                    <Field
                        label="Longitude"
                        name="lng"
                        defaultValue={org.lng}
                        type="number"
                        step="any"
                        hint="Ex: 4.4525"
                        error={fieldErrors.lng}
                    />
                </div>
            </Section>

            {/* SECTION : Contact */}
            <Section
                title="Contact"
                description="Au moins un canal pour que les pêcheurs te joignent."
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field
                        label="Email"
                        name="contact_email"
                        type="email"
                        defaultValue={org.contact_email}
                        error={fieldErrors.contact_email}
                    />
                    <Field
                        label="Téléphone"
                        name="contact_phone"
                        defaultValue={org.contact_phone}
                        error={fieldErrors.contact_phone}
                    />
                </div>
                <Field
                    label="Site web"
                    name="website"
                    type="url"
                    defaultValue={org.website}
                    hint="https://..."
                    error={fieldErrors.website}
                />
            </Section>

            {/* SECTION : Réseaux */}
            <Section
                title="Réseaux sociaux"
                description="Optionnel. URL complète ou identifiant."
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field
                        label="Facebook"
                        name="social_facebook"
                        defaultValue={org.social_facebook}
                        error={fieldErrors.social_facebook}
                    />
                    <Field
                        label="Instagram"
                        name="social_instagram"
                        defaultValue={org.social_instagram}
                        hint="@compte ou URL"
                        error={fieldErrors.social_instagram}
                    />
                </div>
            </Section>

            {/* Submit */}
            <div className="border-t border-border pt-8 flex flex-wrap items-center justify-between gap-4 sticky bottom-0 bg-background/95 backdrop-blur py-4">
                <div className="text-sm">
                    {error && <span className="text-destructive">{error}</span>}
                    {success && (
                        <span className="text-primary">Modifications enregistrées.</span>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-7 py-3 text-sm font-medium tracking-wide uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
            </div>
        </form>
    );
}

function Section({
                     title,
                     description,
                     children,
                 }: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-5">
            <div>
                <h2 className="font-display text-xl tracking-tight">{title}</h2>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        {description}
                    </p>
                )}
            </div>
            <div className="space-y-5">{children}</div>
        </div>
    );
}

function Field({
                   label,
                   name,
                   type = "text",
                   defaultValue,
                   required = false,
                   hint,
                   error,
                   step,
               }: {
    label: string;
    name: string;
    type?: string;
    defaultValue?: string;
    required?: boolean;
    hint?: string;
    error?: string;
    step?: string;
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
                defaultValue={defaultValue}
                required={required}
                step={step}
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
                         defaultValue,
                         options,
                         required = false,
                         hint,
                         error,
                     }: {
    label: string;
    name: string;
    defaultValue?: string;
    options: { value: string; label: string }[];
    required?: boolean;
    hint?: string;
    error?: string;
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
          {required && " *"}
      </span>
            <select
                name={name}
                defaultValue={defaultValue}
                required={required}
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
            {!error && hint && (
                <span className="mt-1.5 text-xs text-muted-foreground block">{hint}</span>
            )}
        </label>
    );
}

function Textarea({
                      label,
                      name,
                      defaultValue,
                      rows = 4,
                      required = false,
                      hint,
                      error,
                  }: {
    label: string;
    name: string;
    defaultValue?: string;
    rows?: number;
    required?: boolean;
    hint?: string;
    error?: string;
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
          {required && " *"}
      </span>
            <textarea
                name={name}
                defaultValue={defaultValue}
                rows={rows}
                required={required}
                className={`mt-2 w-full bg-background border px-4 py-3 text-sm focus:outline-none transition-colors resize-y ${
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