"use client";

import { useState } from "react";
import {
    getPostalMaxLength,
    getPostalPlaceholder,
    isValidPostalCode,
    type AddressCountry,
    type AddressFieldName,
} from "@/lib/utils/address";

type Props = {
    country: AddressCountry;
    names: AddressFieldName; // ex: { line1: "address", postal_code: "postal_code", city: "city" }
    defaultValues?: { line1?: string; postal_code?: string; city?: string };
    required?: boolean;
    errors?: { line1?: string; postal_code?: string; city?: string };
    labels?: { line1?: string; postal_code?: string; city?: string };
};

export function AddressInput({
                                 country,
                                 names,
                                 defaultValues,
                                 required,
                                 errors,
                                 labels,
                             }: Props) {
    const [postalCode, setPostalCode] = useState(defaultValues?.postal_code ?? "");
    const [postalTouched, setPostalTouched] = useState(false);

    const postalValid = !postalCode || isValidPostalCode(postalCode, country);
    const showPostalError = postalTouched && postalCode.length > 0 && !postalValid;

    return (
        <div className="space-y-5">
            <FieldShell
                label={labels?.line1 ?? "Adresse"}
                required={required}
                error={errors?.line1}
            >
                <input
                    type="text"
                    name={names.line1}
                    defaultValue={defaultValues?.line1 ?? ""}
                    required={required}
                    placeholder="Rue et numéro"
                    autoComplete="street-address"
                    className={`mt-2 w-full bg-background border px-4 py-3 text-sm focus:outline-none transition-colors ${
                        errors?.line1
                            ? "border-destructive focus:border-destructive"
                            : "border-border focus:border-accent"
                    }`}
                />
            </FieldShell>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <FieldShell
                    label={labels?.postal_code ?? "Code postal"}
                    required={required}
                    error={errors?.postal_code ?? (showPostalError
                        ? `Format attendu : ${country === "BE" ? "4 chiffres" : "5 chiffres"}`
                        : undefined)}
                >
                    <input
                        type="text"
                        name={names.postal_code}
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        onBlur={() => setPostalTouched(true)}
                        required={required}
                        inputMode="numeric"
                        placeholder={getPostalPlaceholder(country)}
                        maxLength={getPostalMaxLength(country)}
                        autoComplete="postal-code"
                        className={`mt-2 w-full bg-background border px-4 py-3 text-sm focus:outline-none transition-colors ${
                            errors?.postal_code || showPostalError
                                ? "border-destructive focus:border-destructive"
                                : "border-border focus:border-accent"
                        }`}
                    />
                </FieldShell>

                <div className="sm:col-span-2">
                    <FieldShell
                        label={labels?.city ?? "Ville"}
                        required={required}
                        error={errors?.city}
                    >
                        <input
                            type="text"
                            name={names.city}
                            defaultValue={defaultValues?.city ?? ""}
                            required={required}
                            autoComplete="address-level2"
                            className={`mt-2 w-full bg-background border px-4 py-3 text-sm focus:outline-none transition-colors ${
                                errors?.city
                                    ? "border-destructive focus:border-destructive"
                                    : "border-border focus:border-accent"
                            }`}
                        />
                    </FieldShell>
                </div>
            </div>
        </div>
    );
}

function FieldShell({
                        label,
                        required,
                        error,
                        children,
                    }: {
    label: string;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {label}
                {required && " *"}
            </span>
            {children}
            {error && (
                <span className="mt-1.5 text-xs text-destructive block">{error}</span>
            )}
        </label>
    );
}