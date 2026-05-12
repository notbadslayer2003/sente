"use client";

import {useState, useTransition} from "react";
import {updateProfileAction} from "@/app/actions/profile";
import {ESPECES} from "@/lib/constants/especes";
import {COUNTRIES} from "@/lib/constants/regions";
import {MultiSelectChips} from "@/components/sente/multi-select-chips";
import {PhoneInput} from "@/components/sente/phone-input";

type Profile = {
    full_name: string;
    phone: string;
    bio: string;
    city: string;
    country: string;
    especes_pref: string[];
    marketing_opt_in: boolean;
};

export function ProfileSettingsForm({profile}: { profile: Profile }) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setSuccess(false);
        setFieldErrors({});

        startTransition(async () => {
            const r = await updateProfileAction(fd);
            if (r.ok) {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 4000);
            } else {
                setError(r.error);
                setFieldErrors(r.fieldErrors ?? {});
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-10 border border-border bg-secondary/20 p-8">
            <div>
                <h2 className="font-display text-xl tracking-tight">Profil</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Tes infos visibles publiquement (nom, ville). Email et mot de passe
                    se gèrent depuis la page de connexion.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field
                    label="Nom complet"
                    name="full_name"
                    defaultValue={profile.full_name}
                    required
                    error={fieldErrors.full_name}
                />
                <SelectField
                    label="Pays"
                    name="country"
                    defaultValue={profile.country}
                    options={[
                        {value: "", label: "Non renseigné"},
                        ...COUNTRIES.map((c) => ({value: c.value, label: c.label})),
                    ]}
                />
            </div>

            <PhoneInput
                label="Téléphone"
                name="phone"
                defaultValue={profile.phone}
                defaultCountry={profile.country === "FR" ? "FR" : "BE"}
                hint="Pour pré-remplir tes inscriptions aux événements. Jamais affiché publiquement."
                error={fieldErrors.phone}
            />

            <Field
                label="Ville"
                name="city"
                defaultValue={profile.city}
                hint="Optionnel, jamais affiché publiquement."
            />

            <Textarea
                label="Bio"
                name="bio"
                defaultValue={profile.bio}
                rows={3}
                hint="Quelques mots sur toi (500 caractères max)."
                error={fieldErrors.bio}
            />

            <div>
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground block">
                  Espèces préférées
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                    Pour personnaliser ton fil et tes recommandations.
                </p>
                <div className="mt-3">
                    <MultiSelectChips
                        name="especes_pref"
                        options={ESPECES}
                        defaultSelected={profile.especes_pref}
                    />
                </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    name="marketing_opt_in"
                    defaultChecked={profile.marketing_opt_in}
                    className="mt-1 accent-[var(--accent)]"
                />
                <span className="text-sm">
          Je veux recevoir les nouveautés et conseils Sente par email
                    <span className="block text-xs text-muted-foreground mt-0.5">
            Désinscription en un clic depuis chaque email.
          </span>
        </span>
            </label>

            <div className="border-t border-border pt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm">
                    {error && <span className="text-destructive">{error}</span>}
                    {success && (
                        <span className="text-primary">Profil enregistré.</span>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-7 py-3 text-sm font-medium tracking-wide uppercase disabled:opacity-50"
                >
                    {isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
            </div>
        </form>
    );
}

function Field({
                   label,
                   name,
                   defaultValue,
                   required = false,
                   hint,
                   error,
               }: {
    label: string;
    name: string;
    defaultValue?: string;
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
            <input
                type="text"
                name={name}
                defaultValue={defaultValue}
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
                     }: {
    label: string;
    name: string;
    defaultValue?: string;
    options: { value: string; label: string }[];
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
            <select
                name={name}
                defaultValue={defaultValue}
                className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent cursor-pointer"
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

function Textarea({
                      label,
                      name,
                      defaultValue,
                      rows = 4,
                      hint,
                      error,
                  }: {
    label: string;
    name: string;
    defaultValue?: string;
    rows?: number;
    hint?: string;
    error?: string;
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
            <textarea
                name={name}
                defaultValue={defaultValue}
                rows={rows}
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