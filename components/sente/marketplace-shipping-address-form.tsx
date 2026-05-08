"use client";

import { useState, useTransition } from "react";
import { updateMyShippingAddress } from "@/app/actions/marketplace/seller-shipping-address";

// =============================================================================
// MarketplaceShippingAddressForm — adresse d'expédition seller
// =============================================================================
// Affichée sur /profil/marketplace/compte-vendeur sous la section KYC.
// Indépendante du KYC : un seller peut la renseigner à tout moment.
// Devient bloquante au moment du markAsShipped (8c.3) si vide.
// =============================================================================

const INPUT_CLS =
    "mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent";
const SELECT_CLS = `${INPUT_CLS} cursor-pointer`;

type SellerAccountShipping = {
    shipping_from_line1: string | null;
    shipping_from_postal_code: string | null;
    shipping_from_city: string | null;
    shipping_from_country: "BE" | "FR" | null;
    shipping_from_phone: string | null;
};

export function MarketplaceShippingAddressForm({
                                                   account,
                                               }: {
    account: SellerAccountShipping | null;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [form, setForm] = useState({
        line1: account?.shipping_from_line1 ?? "",
        postal_code: account?.shipping_from_postal_code ?? "",
        city: account?.shipping_from_city ?? "",
        country: (account?.shipping_from_country ?? "BE") as "BE" | "FR",
        phone: account?.shipping_from_phone ?? "",
    });

    const isComplete = Boolean(
        account?.shipping_from_line1 &&
        account?.shipping_from_postal_code &&
        account?.shipping_from_city &&
        account?.shipping_from_country &&
        account?.shipping_from_phone
    );

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        startTransition(async () => {
            const result = await updateMyShippingAddress(form);
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            setSuccess(true);
        });
    }

    return (
        <section className="space-y-6">
            <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Adresse d&apos;expédition
                </p>
                <h2 className="mt-2 font-display text-2xl tracking-tight">
                    D&apos;où tu envoies tes colis
                </h2>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Cette adresse est imprimée sur les bordereaux d&apos;expédition Mondial Relay
                    et sert d&apos;adresse retour si un colis n&apos;est pas récupéré. Elle
                    peut différer de ton adresse fiscale.
                </p>
            </div>

            {/* Bandeau état */}
            {!isComplete && (
                <div className="border border-accent/30 bg-accent/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                        À compléter
                    </p>
                    <p className="mt-2 text-sm">
                        Renseigne ton adresse d&apos;expédition pour pouvoir expédier tes
                        ventes.
                    </p>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
                <FormField label="Adresse complète *">
                    <input
                        required
                        type="text"
                        value={form.line1}
                        onChange={(e) => setForm({ ...form, line1: e.target.value })}
                        placeholder="Rue, n°"
                        maxLength={200}
                        className={INPUT_CLS}
                    />
                </FormField>

                <div className="grid grid-cols-3 gap-3">
                    <FormField label="Code postal *">
                        <input
                            required
                            type="text"
                            value={form.postal_code}
                            onChange={(e) =>
                                setForm({ ...form, postal_code: e.target.value })
                            }
                            maxLength={10}
                            className={INPUT_CLS}
                        />
                    </FormField>
                    <FormField label="Ville *" className="col-span-2">
                        <input
                            required
                            type="text"
                            value={form.city}
                            onChange={(e) => setForm({ ...form, city: e.target.value })}
                            maxLength={100}
                            className={INPUT_CLS}
                        />
                    </FormField>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <FormField label="Pays *">
                        <select
                            value={form.country}
                            onChange={(e) =>
                                setForm({ ...form, country: e.target.value as "BE" | "FR" })
                            }
                            className={SELECT_CLS}
                        >
                            <option value="BE">Belgique</option>
                            <option value="FR">France</option>
                        </select>
                    </FormField>
                    <FormField label="Téléphone *" className="col-span-2">
                        <input
                            required
                            type="tel"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder={form.country === "BE" ? "0470 12 34 56" : "06 12 34 56 78"}
                            maxLength={20}
                            className={INPUT_CLS}
                        />
                    </FormField>
                </div>

                {error && (
                    <div className="border border-destructive/30 bg-destructive/5 p-3">
                        <p className="text-xs text-destructive">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="border border-primary/30 bg-primary/5 p-3">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
                            Enregistré
                        </p>
                        <p className="mt-1 text-xs">
                            Ton adresse d&apos;expédition est à jour.
                        </p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending ? "Enregistrement…" : "Enregistrer"}
                </button>
            </form>
        </section>
    );
}

function FormField({
                       label,
                       children,
                       className,
                   }: {
    label: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <label className={`block ${className ?? ""}`}>
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
            </span>
            {children}
        </label>
    );
}