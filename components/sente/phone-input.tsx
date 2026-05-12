"use client";

import { useState, useMemo } from "react";
import {
    PHONE_COUNTRIES,
    toE164,
    toNationalDisplay,
    detectCountry,
    formatAsYouType,
    type PhoneCountry,
} from "@/lib/utils/phone";

type Props = {
    name: string;
    label: string;
    defaultValue?: string | null;
    defaultCountry?: PhoneCountry;
    required?: boolean;
    hint?: string;
    error?: string;
};

export function PhoneInput({
                               name,
                               label,
                               defaultValue,
                               defaultCountry,
                               required,
                               hint,
                               error,
                           }: Props) {
    // Initialisation : si on reçoit du E.164, on extrait le pays + le format national
    const initial = useMemo(() => {
        const c = defaultCountry ?? detectCountry(defaultValue);
        return {
            country: c,
            display: toNationalDisplay(defaultValue),
            e164: toE164(defaultValue ?? "", c) ?? "",
        };
    }, [defaultValue, defaultCountry]);

    const [country, setCountry] = useState<PhoneCountry>(initial.country);
    const [display, setDisplay] = useState(initial.display);
    const [e164, setE164] = useState(initial.e164);
    const [touched, setTouched] = useState(false);

    const onChange = (raw: string) => {
        const formatted = formatAsYouType(raw, country);
        setDisplay(formatted);
        setE164(toE164(raw, country) ?? "");
    };

    const onCountryChange = (newCountry: PhoneCountry) => {
        setCountry(newCountry);
        setE164(toE164(display, newCountry) ?? "");
    };

    const isInvalid = touched && display.length > 0 && !e164;
    const hasError = !!error || isInvalid;

    const placeholder = country === "BE" ? "0477 12 34 56" : "06 12 34 56 78";

    return (
        <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {label}
                {required && " *"}
            </span>
            <div
                className={`mt-2 flex border bg-background transition-colors ${
                    hasError
                        ? "border-destructive"
                        : "border-border focus-within:border-accent"
                }`}
            >
                <select
                    value={country}
                    onChange={(e) => onCountryChange(e.target.value as PhoneCountry)}
                    aria-label="Indicatif pays"
                    className="bg-transparent text-xs uppercase tracking-wide px-3 py-3 cursor-pointer border-r border-border focus:outline-none"
                >
                    {PHONE_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                            {c.code} {c.dial}
                        </option>
                    ))}
                </select>
                <input
                    type="tel"
                    value={display}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setTouched(true)}
                    required={required}
                    placeholder={placeholder}
                    autoComplete="tel"
                    className="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none"
                />
            </div>

            {/* Valeur E.164 envoyée dans FormData */}
            <input type="hidden" name={name} value={e164} />

            {error && (
                <span className="mt-1.5 text-xs text-destructive block">{error}</span>
            )}
            {!error && isInvalid && (
                <span className="mt-1.5 text-xs text-destructive block">
                    Numéro invalide.
                </span>
            )}
            {!hasError && hint && (
                <span className="mt-1.5 text-xs text-muted-foreground block">
                    {hint}
                </span>
            )}
        </label>
    );
}