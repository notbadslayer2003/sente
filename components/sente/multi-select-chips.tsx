"use client";

import { useState } from "react";

type Option = { value: string; label: string };

export function MultiSelectChips({
                                     name,
                                     options,
                                     defaultSelected = [],
                                     hint,
                                 }: {
    name: string;
    options: readonly Option[];
    defaultSelected?: readonly string[];
    hint?: string;
}) {
    const [selected, setSelected] = useState<Set<string>>(
        new Set(defaultSelected)
    );

    const toggle = (value: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return next;
        });
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                    const active = selected.has(opt.value);
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggle(opt.value)}
                            className={`px-3 py-1.5 text-xs uppercase tracking-wide border transition-colors ${
                                active
                                    ? "bg-accent text-accent-foreground border-accent"
                                    : "border-border hover:border-accent text-foreground"
                            }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
            {/* Inputs hidden pour que le formulaire envoie une liste */}
            {Array.from(selected).map((value) => (
                <input key={value} type="hidden" name={name} value={value} />
            ))}
            {hint && (
                <p className="text-xs text-muted-foreground">{hint}</p>
            )}
        </div>
    );
}