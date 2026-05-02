"use client";

import { useState, useTransition } from "react";
import { updateMagasinDetailsAction } from "@/app/actions/org-details";
import { SPECIALITES_MAGASIN } from "@/lib/constants/specialites";
import { MultiSelectChips } from "@/components/sente/multi-select-chips";
import { MarquesInput } from "@/components/sente/marques-input";

export type MagasinDetails = {
    org_id: string;
    specialites: string[];
    marques: string[];
    horaires_texte: string;
};

export function MagasinDetailsForm({ details }: { details: MagasinDetails }) {
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
            const r = await updateMagasinDetailsAction(fd);
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
            Spécialités
          </span>
                </label>
                <div className="mt-3">
                    <MultiSelectChips
                        name="specialites"
                        options={SPECIALITES_MAGASIN}
                        defaultSelected={details.specialites}
                        hint="Sélectionne les techniques que tu travailles le plus."
                    />
                </div>
            </div>

            <div>
                <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Marques distribuées
          </span>
                </label>
                <div className="mt-3">
                    <MarquesInput name="marques" defaultValue={details.marques} />
                </div>
            </div>

            <label className="block">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Horaires (format libre)
        </span>
                <textarea
                    name="horaires_texte"
                    defaultValue={details.horaires_texte}
                    rows={4}
                    placeholder="Ex: Lundi-Vendredi 9h-18h, Samedi 9h-17h, Dimanche fermé."
                    className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent resize-y"
                />
                <span className="mt-1.5 text-xs text-muted-foreground block">
          Saisie libre, multi-lignes acceptées.
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