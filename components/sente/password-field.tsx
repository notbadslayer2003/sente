"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = {
    label: string;
    name: string;
    required?: boolean;
    autoComplete?: string;
    minLength?: number;
    placeholder?: string;
    defaultValue?: string;
    error?: string;
    hint?: string;
};

export function PasswordField({
                                  label,
                                  name,
                                  required = false,
                                  autoComplete,
                                  minLength,
                                  placeholder,
                                  defaultValue,
                                  error,
                                  hint,
                              }: Props) {
    const [visible, setVisible] = useState(false);

    return (
        <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {label}
            </span>
            <div className="mt-2 relative">
                <input
                    type={visible ? "text" : "password"}
                    name={name}
                    required={required}
                    autoComplete={autoComplete}
                    minLength={minLength}
                    placeholder={placeholder}
                    defaultValue={defaultValue}
                    className={`w-full bg-background border pl-4 pr-12 py-3 text-sm focus:outline-none transition-colors ${
                        error
                            ? "border-destructive focus:border-destructive"
                            : "border-border focus:border-accent"
                    }`}
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={
                        visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                    {visible ? (
                        <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                    ) : (
                        <Eye className="w-4 h-4" strokeWidth={1.5} />
                    )}
                </button>
            </div>
            {error && (
                <span className="mt-1.5 text-xs text-destructive block">{error}</span>
            )}
            {!error && hint && (
                <span className="mt-1.5 text-xs text-muted-foreground block">
                    {hint}
                </span>
            )}
        </label>
    );
}