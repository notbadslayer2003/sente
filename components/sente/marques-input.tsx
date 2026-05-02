"use client";

import { useState, type KeyboardEvent } from "react";

export function MarquesInput({
                                 name,
                                 defaultValue = [],
                                 maxItems = 50,
                             }: {
    name: string;
    defaultValue?: readonly string[];
    maxItems?: number;
}) {
    const [marques, setMarques] = useState<string[]>([...defaultValue]);
    const [input, setInput] = useState("");

    const add = () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        if (marques.length >= maxItems) return;
        if (marques.includes(trimmed)) {
            setInput("");
            return;
        }
        setMarques((prev) => [...prev, trimmed]);
        setInput("");
    };

    const remove = (m: string) => {
        setMarques((prev) => prev.filter((x) => x !== m));
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
        } else if (e.key === "Backspace" && !input && marques.length > 0) {
            // Backspace sur input vide retire le dernier tag
            setMarques((prev) => prev.slice(0, -1));
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {marques.map((m) => (
                    <span
                        key={m}
                        className="inline-flex items-center gap-2 bg-secondary border border-border px-3 py-1.5 text-xs"
                    >
                        {m}
                        <button
                            type="button"
                            onClick={() => remove(m)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label={`Retirer ${m}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={
                        marques.length === 0
                            ? "Ex: Korda, Shimano, Daiwa... (Entrée ou virgule pour valider)"
                            : "Ajouter une marque..."
                    }
                    disabled={marques.length >= maxItems}
                    className="flex-1 bg-background border border-border px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                />
                <button
                    type="button"
                    onClick={add}
                    disabled={!input.trim() || marques.length >= maxItems}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-4 py-2.5 text-xs uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Ajouter
                </button>
            </div>

            {marques.length >= maxItems && (
                <p className="text-xs text-muted-foreground">
                    Limite de {maxItems} marques atteinte.
                </p>
            )}

            {/* Inputs hidden pour le submit */}
            {marques.map((m) => (
                <input key={m} type="hidden" name={name} value={m} />
            ))}
        </div>
    );
}