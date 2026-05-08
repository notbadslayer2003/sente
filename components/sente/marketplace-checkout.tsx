"use client";

import { useState, useTransition } from "react";
import {
    getCheckoutQuoteFromListing,
    getCheckoutQuoteFromOffer,
    createOrderAndCheckoutSession,
    type CheckoutQuoteData,
} from "@/app/actions/marketplace/checkout";
import { createMyAddress } from "@/app/actions/marketplace/addresses";
import { formatCents } from "@/lib/marketplace/pricing";
import type { MarketplaceAddress } from "@/lib/dal/marketplace-addresses";
import type { ShippingCarrier } from "@/lib/marketplace/shipping";
import { MarketplaceRelayPointPicker } from "@/components/sente/marketplace-relay-point-picker";

// =============================================================================
// MarketplaceCheckout — flow checkout marketplace via Stripe Checkout Sessions
// =============================================================================
// 3 sections : adresse → transporteur → récap. Bouton final redirige vers
// checkout.stripe.com. Au retour, success_url ramène vers la page commande.
// =============================================================================

const INPUT_CLS =
    "mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent";
const SELECT_CLS = `${INPUT_CLS} cursor-pointer`;

export function MarketplaceCheckout({
                                        contextType,
                                        contextId,
                                        initialQuote,
                                        addresses,
                                    }: {
    contextType: "listing" | "offer";
    contextId: string;
    initialQuote: CheckoutQuoteData;
    addresses: MarketplaceAddress[];
}) {
    const [isPending, startTransition] = useTransition();

    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
        addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null
    );
    const [showNewAddressForm, setShowNewAddressForm] = useState(
        addresses.length === 0
    );
    const [localAddresses, setLocalAddresses] = useState(addresses);

    const [carrier, setCarrier] = useState<ShippingCarrier | null>(null);
    const [relayPointId, setRelayPointId] = useState("");
    const [quote, setQuote] = useState<CheckoutQuoteData>(initialQuote);
    const [error, setError] = useState<string | null>(null);

    function handleCarrierChange(c: ShippingCarrier) {
        setCarrier(c);
        setError(null);
        startTransition(async () => {
            const result =
                contextType === "listing"
                    ? await getCheckoutQuoteFromListing({
                        listingId: contextId,
                        carrier: c,
                    })
                    : await getCheckoutQuoteFromOffer({
                        offerId: contextId,
                        carrier: c,
                    });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            setQuote(result.data);
        });
    }

    function handlePay() {
        if (!selectedAddressId || !carrier) return;
        if (carrier === "mondial_relay" && !relayPointId.trim()) {
            setError("Saisis le code postal du point relais Mondial Relay");
            return;
        }
        setError(null);

        startTransition(async () => {
            const result = await createOrderAndCheckoutSession({
                listingId: contextType === "listing" ? contextId : undefined,
                offerId: contextType === "offer" ? contextId : undefined,
                addressId: selectedAddressId,
                carrier,
                relayPointId:
                    carrier === "mondial_relay" ? relayPointId.trim() : null,
            });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            window.location.href = result.data.checkout_url;
        });
    }

    return (
        <div className="space-y-10">
            {/* Récap article */}
            <div className="border border-border bg-secondary/20 p-5">
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Article
                </p>
                <p className="mt-2 font-display text-lg tracking-tight">
                    {quote.listing_title}
                </p>
                <p className="mt-2 font-display text-2xl tracking-tight">
                    {formatCents(quote.base_price_cents)}
                </p>
                {quote.is_from_offer && (
                    <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-accent">
                        Offre acceptée par le vendeur
                    </p>
                )}
            </div>

            {/* Étape 1 — Adresse */}
            <Step number={1} title="Adresse de livraison">
                <AddressPicker
                    addresses={localAddresses}
                    selectedId={selectedAddressId}
                    onSelect={setSelectedAddressId}
                    showNewForm={showNewAddressForm}
                    onShowNewForm={setShowNewAddressForm}
                    onAddressCreated={(newAddr) => {
                        setLocalAddresses([newAddr, ...localAddresses]);
                        setSelectedAddressId(newAddr.id);
                        setShowNewAddressForm(false);
                    }}
                />
            </Step>

            {/* Étape 2 — Transporteur */}
            {selectedAddressId && (
                <Step number={2} title="Mode de livraison">
                    <CarrierPicker
                        options={quote.shipping_options}
                        selected={carrier}
                        onSelect={handleCarrierChange}
                        relayPointId={relayPointId}
                        onRelayPointIdChange={setRelayPointId}
                        initialPostalCode={
                            localAddresses.find((a) => a.id === selectedAddressId)
                                ?.postal_code
                        }
                        initialCountry={
                            localAddresses.find((a) => a.id === selectedAddressId)
                                ?.country
                        }
                    />
                </Step>
            )}

            {/* Étape 3 — Récap */}
            {quote.pricing && (
                <Step number={3} title="Récapitulatif">
                    <PricingRecap pricing={quote.pricing} />
                </Step>
            )}

            {/* Erreur */}
            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}

            {/* Bouton paiement */}
            {quote.pricing && (
                <button
                    type="button"
                    onClick={handlePay}
                    disabled={
                        isPending ||
                        !selectedAddressId ||
                        !carrier ||
                        (carrier === "mondial_relay" && !relayPointId.trim())
                    }
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors py-4 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending
                        ? "Redirection vers le paiement…"
                        : `Payer ${formatCents(quote.pricing.buyer_pays_cents)} →`}
                </button>
            )}
        </div>
    );
}

// =============================================================================
// Helpers visuels
// =============================================================================

function Step({
                  number,
                  title,
                  children,
              }: {
    number: number;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-5">
            <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Étape {number}
                </p>
                <h2 className="mt-1 font-display text-xl tracking-tight">{title}</h2>
            </div>
            <div>{children}</div>
        </div>
    );
}

// =============================================================================
// AddressPicker
// =============================================================================
function AddressPicker({
                           addresses,
                           selectedId,
                           onSelect,
                           showNewForm,
                           onShowNewForm,
                           onAddressCreated,
                       }: {
    addresses: MarketplaceAddress[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    showNewForm: boolean;
    onShowNewForm: (show: boolean) => void;
    onAddressCreated: (a: MarketplaceAddress) => void;
}) {
    return (
        <div className="space-y-4">
            {addresses.length > 0 && (
                <ul className="space-y-3">
                    {addresses.map((a) => (
                        <li key={a.id}>
                            <label
                                className={`flex cursor-pointer items-start gap-4 border p-4 transition-colors ${
                                    selectedId === a.id
                                        ? "border-accent bg-accent/5"
                                        : "border-border hover:border-foreground"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="address"
                                    checked={selectedId === a.id}
                                    onChange={() => onSelect(a.id)}
                                    className="mt-1 accent-accent"
                                />
                                <div className="text-sm">
                                    <p className="flex items-center gap-2">
                                        <span className="font-medium">{a.full_name}</span>
                                        {a.label && (
                                            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                                {a.label}
                                            </span>
                                        )}
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                                        {a.line1}
                                        {a.line2 && <>, {a.line2}</>}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {a.postal_code} {a.city}, {a.country}
                                    </p>
                                </div>
                            </label>
                        </li>
                    ))}
                </ul>
            )}

            {showNewForm ? (
                <NewAddressForm
                    onCreated={onAddressCreated}
                    onCancel={() => onShowNewForm(false)}
                />
            ) : (
                <button
                    type="button"
                    onClick={() => onShowNewForm(true)}
                    className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                >
                    + Ajouter une adresse
                </button>
            )}
        </div>
    );
}

// =============================================================================
// NewAddressForm
// =============================================================================
function NewAddressForm({
                            onCreated,
                            onCancel,
                        }: {
    onCreated: (a: MarketplaceAddress) => void;
    onCancel: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        full_name: "",
        line1: "",
        line2: "",
        postal_code: "",
        city: "",
        country: "BE" as "BE" | "FR",
        phone: "",
        label: "",
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const result = await createMyAddress({ ...form, is_default: false });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            onCreated({
                id: result.data.id,
                user_id: "",
                ...form,
                is_default: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        });
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 border border-border bg-secondary/20 p-5"
        >
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Nouvelle adresse
            </p>

            <FormField label="Nom complet *">
                <input
                    required
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className={INPUT_CLS}
                />
            </FormField>

            <FormField label="Adresse *">
                <input
                    required
                    type="text"
                    value={form.line1}
                    onChange={(e) => setForm({ ...form, line1: e.target.value })}
                    placeholder="Rue, n°"
                    className={INPUT_CLS}
                />
            </FormField>

            <FormField label="Complément">
                <input
                    type="text"
                    value={form.line2}
                    onChange={(e) => setForm({ ...form, line2: e.target.value })}
                    placeholder="Appartement, étage, lieu-dit…"
                    className={INPUT_CLS}
                />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
                <FormField label="Code postal *">
                    <input
                        required
                        type="text"
                        value={form.postal_code}
                        onChange={(e) =>
                            setForm({ ...form, postal_code: e.target.value })
                        }
                        className={INPUT_CLS}
                    />
                </FormField>
                <FormField label="Ville *">
                    <input
                        required
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        className={INPUT_CLS}
                    />
                </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <FormField label="Téléphone">
                    <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className={INPUT_CLS}
                    />
                </FormField>
            </div>

            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}

            <div className="flex items-center gap-4 pt-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending ? "Enregistrement…" : "Enregistrer l'adresse"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}

function FormField({
                       label,
                       children,
                   }: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
            </span>
            {children}
        </label>
    );
}

// =============================================================================
// CarrierPicker
// =============================================================================
function CarrierPicker({
                           options,
                           selected,
                           onSelect,
                           relayPointId,
                           onRelayPointIdChange,
                           initialPostalCode,
                           initialCountry,
                       }: {
    options: {
        carrier: ShippingCarrier;
        label: string;
        description: string;
        price_cents: number;
    }[];
    selected: ShippingCarrier | null;
    onSelect: (c: ShippingCarrier) => void;
    relayPointId: string;
    onRelayPointIdChange: (s: string) => void;
    initialPostalCode?: string;
    initialCountry?: "BE" | "FR";
}) {
    return (
        <div className="space-y-3">
            {options.map((opt) => (
                <label
                    key={opt.carrier}
                    className={`flex cursor-pointer items-center gap-4 border p-4 transition-colors ${
                        selected === opt.carrier
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-foreground"
                    }`}
                >
                    <input
                        type="radio"
                        name="carrier"
                        checked={selected === opt.carrier}
                        onChange={() => onSelect(opt.carrier)}
                        className="accent-accent"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                            {opt.description}
                        </p>
                    </div>
                    <span className="font-display text-base tracking-tight whitespace-nowrap">
                        {formatCents(opt.price_cents)}
                    </span>
                </label>
            ))}

            {selected === "mondial_relay" && (
                <div className="mt-4">
                    <MarketplaceRelayPointPicker
                        initialPostalCode={initialPostalCode}
                        initialCountry={initialCountry}
                        selectedRelayId={relayPointId || null}
                        onRelaySelected={(id) => onRelayPointIdChange(id ?? "")}
                    />
                </div>
            )}
        </div>
    );
}

// =============================================================================
// PricingRecap
// =============================================================================
function PricingRecap({
                          pricing,
                      }: {
    pricing: NonNullable<CheckoutQuoteData["pricing"]>;
}) {
    return (
        <dl className="divide-y divide-border border-y border-border">
            <Row label="Article" value={formatCents(pricing.listing_price_cents)} />
            <Row label="Livraison" value={formatCents(pricing.shipping_cents)} />
            <Row
                label="Frais de service"
                value={formatCents(pricing.stripe_fee_passthrough_cents)}
                muted
            />
            <Row
                label="Total à payer"
                value={formatCents(pricing.buyer_pays_cents)}
                bold
            />
        </dl>
    );
}

function Row({
                 label,
                 value,
                 bold,
                 muted,
             }: {
    label: string;
    value: string;
    bold?: boolean;
    muted?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-3">
            <dt
                className={`text-[10px] uppercase tracking-[0.2em] ${
                    muted ? "text-muted-foreground/70" : "text-muted-foreground"
                }`}
            >
                {label}
            </dt>
            <dd
                className={
                    bold
                        ? "font-display text-2xl tracking-tight"
                        : muted
                            ? "text-sm text-muted-foreground"
                            : "text-sm"
                }
            >
                {value}
            </dd>
        </div>
    );
}