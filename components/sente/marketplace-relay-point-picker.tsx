"use client";

import { useState, useTransition } from "react";
import { searchMondialRelayRelays } from "@/app/actions/marketplace/mondial-relay";
import type { RelayPoint } from "@/lib/mondial-relay/operations";

// =============================================================================
// RelayPointPicker — sélection point relais Mondial Relay pendant le checkout
// =============================================================================
// Workflow :
//   1. Saisie CP (prefill possible depuis adresse livraison)
//   2. Bouton "Rechercher" → server action → liste relais
//   3. Sélection d'un relais → l'ID est remonté au parent via onRelaySelected
//
// État stocké côté parent : le selectedRelayId (string MR ID, ex "010292").
// On stocke en plus localement le selectedRelay complet (objet) pour afficher
// les détails sans avoir à refaire un appel API.
// =============================================================================

const INPUT_CLS =
    "mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent";

export function MarketplaceRelayPointPicker({
                                                initialPostalCode,
                                                initialCountry,
                                                selectedRelayId,
                                                onRelaySelected,
                                            }: {
    initialPostalCode?: string;
    initialCountry?: "BE" | "FR";
    selectedRelayId: string | null;
    onRelaySelected: (relayId: string | null) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [searchPostalCode, setSearchPostalCode] = useState(initialPostalCode ?? "");
    const [searchCountry, setSearchCountry] = useState<"BE" | "FR">(
        initialCountry ?? "BE"
    );
    const [results, setResults] = useState<RelayPoint[]>([]);
    const [selectedRelay, setSelectedRelay] = useState<RelayPoint | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    function handleSearch(e?: React.FormEvent) {
        e?.preventDefault();
        if (!searchPostalCode.trim()) return;

        setError(null);
        setHasSearched(true);

        startTransition(async () => {
            const result = await searchMondialRelayRelays({
                country: searchCountry,
                postalCode: searchPostalCode.trim(),
            });
            if (!result.ok) {
                setError(result.error.message);
                setResults([]);
                return;
            }
            setResults(result.data);
            if (result.data.length === 0) {
                setError(`Aucun point relais trouvé pour ${searchPostalCode}.`);
            }
        });
    }

    function handleSelect(relay: RelayPoint) {
        setSelectedRelay(relay);
        onRelaySelected(relay.id);
    }

    function handleClearSelection() {
        setSelectedRelay(null);
        onRelaySelected(null);
    }

    // Si déjà sélectionné depuis état parent (ex: nav back) — affichage récap
    const displayRelay = selectedRelay;

    return (
        <div className="space-y-4">
            {/* État sélectionné */}
            {displayRelay && selectedRelayId === displayRelay.id ? (
                <div className="border border-accent bg-accent/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                                Point relais sélectionné
                            </p>
                            <p className="mt-2 font-medium text-sm">{displayRelay.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {displayRelay.address}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {displayRelay.postalCode} {displayRelay.city}
                            </p>
                            <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                                ID : {displayRelay.id}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleClearSelection}
                            className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                        >
                            Changer
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* Recherche */}
                    <div className="border border-border bg-secondary/20 p-4 space-y-4">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                            Choisir un point relais
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Saisis le code postal où tu veux récupérer le colis (chez toi,
                            au bureau, peu importe).
                        </p>

                        <form onSubmit={handleSearch} className="flex items-end gap-2">
                            <label className="block flex-shrink-0">
                                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                                    Pays
                                </span>
                                <select
                                    value={searchCountry}
                                    onChange={(e) =>
                                        setSearchCountry(e.target.value as "BE" | "FR")
                                    }
                                    className={`${INPUT_CLS} cursor-pointer w-[80px]`}
                                >
                                    <option value="BE">BE</option>
                                    <option value="FR">FR</option>
                                </select>
                            </label>
                            <label className="block flex-1 min-w-0">
                                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                                    Code postal
                                </span>
                                <input
                                    type="text"
                                    value={searchPostalCode}
                                    onChange={(e) => setSearchPostalCode(e.target.value)}
                                    placeholder="Ex : 7000"
                                    maxLength={10}
                                    className={INPUT_CLS}
                                />
                            </label>
                            <button
                                type="submit"
                                disabled={isPending || !searchPostalCode.trim()}
                                className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50 whitespace-nowrap"
                            >
                                {isPending ? "Recherche…" : "Rechercher"}
                            </button>
                        </form>

                        {error && (
                            <div className="border border-destructive/30 bg-destructive/5 p-3">
                                <p className="text-xs text-destructive">{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Résultats */}
                    {results.length > 0 && (
                        <ul className="divide-y divide-border border-y border-border">
                            {results.map((r) => (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(r)}
                                        className="group flex w-full items-start justify-between gap-4 py-4 text-left hover:bg-secondary/20 transition-colors px-2"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium group-hover:text-accent transition-colors">
                                                {r.name}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {r.address}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {r.postalCode} {r.city}
                                            </p>
                                        </div>
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono whitespace-nowrap">
                                            #{r.id}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {!isPending && hasSearched && results.length === 0 && !error && (
                        <p className="text-xs text-muted-foreground italic">
                            Aucun résultat. Essaie avec un autre code postal.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}