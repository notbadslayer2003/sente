"use client";

import { useState, useTransition } from "react";
import { registerToEventAction } from "@/app/actions/event-register";

export function EventRegistrationForm({
                                          eventId,
                                          priceCents,
                                          initialFullName,
                                          initialPhone,
                                      }: {
    eventId: string;
    priceCents: number;
    initialFullName: string;
    initialPhone: string;
}) {
    const isFree = priceCents === 0;
    const [fullName, setFullName] = useState(initialFullName);
    const [phone, setPhone] = useState(initialPhone);
    const [paymentMethod, setPaymentMethod] = useState<"online_card" | "on_site_cash">(
        "online_card"
    );
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (fullName.trim().length < 2) {
            setError("Nom requis (min 2 caractères).");
            return;
        }
        setError(null);

        const fd = new FormData();
        fd.set("event_id", eventId);
        fd.set("full_name", fullName.trim());
        if (phone.trim()) fd.set("phone", phone.trim());
        fd.set("payment_method", isFree ? "free" : paymentMethod);
        if (notes.trim()) fd.set("notes", notes.trim());

        startTransition(async () => {
            const r = await registerToEventAction(fd);
            if (!r.ok) {
                setError(r.error);
                return;
            }
            // Si paiement → redirige vers Checkout
            if (r.data?.requires_payment && r.data.checkout_url) {
                window.location.href = r.data.checkout_url;
            } else {
                window.location.href = `/evenements/${eventId}/inscription/succes?registration=${r.data?.registration_id}`;
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <Field label="Nom complet *">
                <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
            </Field>

            <Field label="Téléphone (optionnel)">
                <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={50}
                    placeholder="Ex: +32 470 12 34 56"
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
            </Field>

            <Field label="Notes pour l'organisateur (optionnel)">
        <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Ex: allergie alimentaire, message particulier..."
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
        />
            </Field>

            {!isFree && (
                <div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-3">
            Méthode de paiement
          </span>
                    <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer border border-border p-4 hover:bg-secondary/30 transition-colors">
                            <input
                                type="radio"
                                name="payment_method"
                                value="online_card"
                                checked={paymentMethod === "online_card"}
                                onChange={(e) =>
                                    setPaymentMethod(e.target.value as "online_card" | "on_site_cash")
                                }
                                className="mt-1 cursor-pointer"
                            />
                            <div>
                                <p className="text-sm font-medium leading-tight">
                                    Payer en ligne maintenant — {(priceCents / 100).toFixed(2)} €
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Carte ou Bancontact, paiement sécurisé via Stripe
                                </p>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer border border-border p-4 hover:bg-secondary/30 transition-colors">
                            <input
                                type="radio"
                                name="payment_method"
                                value="on_site_cash"
                                checked={paymentMethod === "on_site_cash"}
                                onChange={(e) =>
                                    setPaymentMethod(e.target.value as "online_card" | "on_site_cash")
                                }
                                className="mt-1 cursor-pointer"
                            />
                            <div>
                                <p className="text-sm font-medium leading-tight">
                                    Payer en espèces sur place — {(priceCents / 100).toFixed(2)} €
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Tu règles directement à l&apos;organisateur le jour J
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            <div className="pt-4 border-t border-border">
                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3 text-sm uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending
                        ? "Inscription..."
                        : isFree
                            ? "Confirmer mon inscription"
                            : paymentMethod === "online_card"
                                ? `Payer ${(priceCents / 100).toFixed(2)} €`
                                : "Confirmer mon inscription"}
                </button>
            </div>
        </form>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-1">
        {label}
      </span>
            {children}
        </label>
    );
}