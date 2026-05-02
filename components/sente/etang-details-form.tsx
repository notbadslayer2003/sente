"use client";

import { useState, useTransition } from "react";
import { updateEtangDetailsAction } from "@/app/actions/org-details";
import { ESPECES } from "@/lib/constants/especes";
import { MultiSelectChips } from "@/components/sente/multi-select-chips";

export type EtangDetails = {
    org_id: string;
    especes: string[];
    superficie_ha: string;
    profondeur_max_m: string;
    record_kg: string;
    tarif_journee_eur: string;
    tarif_annee_eur: string;
    reservation_active: boolean;
};

export function EtangDetailsForm({ details }: { details: EtangDetails }) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("org_id", details.org_id);
        setError(null);
        setSuccess(false);

        startTransition(async () => {
            const r = await updateEtangDetailsAction(fd);
            if (r.ok) {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 4000);
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            <div>
                <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Espèces présentes
          </span>
                </label>
                <div className="mt-3">
                    <MultiSelectChips
                        name="especes"
                        options={ESPECES}
                        defaultSelected={details.especes}
                        hint="Coche toutes celles qui sont pêchées chez toi (15 max)."
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <NumField
                    label="Superficie (ha)"
                    name="superficie_ha"
                    defaultValue={details.superficie_ha}
                    step="0.01"
                    hint="Optionnel"
                />
                <NumField
                    label="Profondeur max (m)"
                    name="profondeur_max_m"
                    defaultValue={details.profondeur_max_m}
                    step="0.1"
                    hint="Optionnel"
                />
                <NumField
                    label="Record (kg)"
                    name="record_kg"
                    defaultValue={details.record_kg}
                    step="0.01"
                    hint="Plus gros poisson capturé"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <NumField
                    label="Tarif journée (€)"
                    name="tarif_journee_eur"
                    defaultValue={details.tarif_journee_eur}
                    step="0.01"
                    hint="Indicatif, en euros"
                />
                <NumField
                    label="Tarif annuel (€)"
                    name="tarif_annee_eur"
                    defaultValue={details.tarif_annee_eur}
                    step="0.01"
                    hint="Indicatif, en euros"
                />
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    name="reservation_active"
                    defaultChecked={details.reservation_active}
                    className="accent-[var(--accent)]"
                />
                <span className="text-sm">
          Réservation en ligne active sur la fiche publique
        </span>
            </label>

            <div className="border-t border-border pt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm">
                    {error && <span className="text-destructive">{error}</span>}
                    {success && (
                        <span className="text-primary">Détails enregistrés.</span>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-7 py-3 text-sm font-medium tracking-wide uppercase disabled:opacity-50"
                >
                    {isPending ? "Enregistrement..." : "Enregistrer les détails"}
                </button>
            </div>
        </form>
    );
}

function NumField({
                      label,
                      name,
                      defaultValue,
                      step,
                      hint,
                  }: {
    label: string;
    name: string;
    defaultValue?: string;
    step?: string;
    hint?: string;
}) {
    return (
        <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
            <input
                type="number"
                name={name}
                defaultValue={defaultValue}
                step={step}
                min="0"
                className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent"
            />
            {hint && (
                <span className="mt-1.5 text-xs text-muted-foreground block">
          {hint}
        </span>
            )}
        </label>
    );
}