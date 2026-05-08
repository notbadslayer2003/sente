"use client";

import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import Link from "next/link";
import {
    initSellerKyc,
    submitDac7Info,
} from "@/app/actions/marketplace/seller-kyc";
import type {MarketplaceSellerAccount} from "@/lib/dal/marketplace-seller-account";

// =============================================================================
// MarketplaceKycForm — 5 états du flux KYC vendeur marketplace
// =============================================================================
//  1) verified           → succès + CTA création annonce
//  2) restricted         → bloc erreur + contact support
//  3) pending + TIN miss → form DAC7 (TIN, naissance, adresse)
//  4) pending sans TIN   → bouton reprise du KYC Stripe
//  5) not_started        → form pays + acceptation CGU vendeur
// =============================================================================

interface Props {
    account: MarketplaceSellerAccount | null;
}

const VENDOR_TERMS_VERSION = "1.0";

export function MarketplaceKycForm({account}: Props) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const status = account?.kyc_status ?? "not_started";

    // ── 1. Verified ────────────────────────────────────────────────────────
    if (status === "verified") {
        return (
            <div className="border border-primary/30 bg-primary/5 p-8">
                <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
                    Validé
                </p>
                <h2 className="mt-2 font-display text-2xl tracking-tight">
                    KYC complet
                </h2>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md">
                    Tu peux maintenant publier des annonces et recevoir des paiements
                    sur le marketplace.
                </p>
                <Link
                    href="/profil/marketplace/annonces/nouvelle"
                    className="mt-6 inline-flex items-center justify-center bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium"
                >
                    Créer ma première annonce →
                </Link>
            </div>
        );
    }

    // ── 2. Restricted ──────────────────────────────────────────────────────
    if (status === "restricted") {
        return (
            <div className="border border-destructive/30 bg-destructive/5 p-8">
                <p className="text-[10px] uppercase tracking-[0.25em] text-destructive">
                    Compte bloqué
                </p>
                <h2 className="mt-2 font-display text-2xl tracking-tight">
                    Vente suspendue
                </h2>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Ton compte vendeur est restreint et ne peut plus publier
                    d&apos;annonces.
                </p>
                {account?.restricted_reason && (
                    <div className="mt-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Raison
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                            {account.restricted_reason}
                        </p>
                    </div>
                )}
                <p className="mt-6 text-sm">
                    Contacte{" "}
                    <a
                        href="mailto:bonjour@lasente.eu"
                        className="text-accent hover:underline"
                    >
                        bonjour@lasente.eu
                    </a>{" "}
                    pour faire le point.
                </p>
            </div>
        );
    }

    // ── 3. Pending Stripe complet, TIN manquant ────────────────────────────
    const stripeKycComplete =
        account?.stripe_charges_enabled === true &&
        account?.stripe_payouts_enabled === true &&
        account?.stripe_details_submitted === true;

    const tinMissing = stripeKycComplete && !account?.dac7_tin;

    if (tinMissing) {
        return (
            <div className="space-y-8">
                <div className="border border-accent/30 bg-accent/5 p-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                        Étape 2/2 — Conformité fiscale
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">
                        Identification Stripe validée. Plus qu&apos;un dernier champ pour
                        la conformité européenne DAC7 : ton numéro fiscal.
                    </p>
                </div>
                <TinForm/>
            </div>
        );
    }

    // ── 4-5. Not started OU pending sans Stripe complet ────────────────────
    function handleStart(country: "BE" | "FR") {
        setError(null);
        startTransition(async () => {
            const result = await initSellerKyc({
                country,
                vendorTermsVersion: VENDOR_TERMS_VERSION,
            });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            window.location.href = result.data.onboardingUrl;
        });
    }

    return (
        <div className="space-y-8">
            {status === "pending" && (
                <div className="border border-accent/30 bg-accent/5 p-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                        Étape 1/2 — KYC en cours
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">
                        Ton identification Stripe est démarrée mais incomplète. Reprends
                        là où tu t&apos;es arrêté.
                    </p>
                </div>
            )}

            {status === "not_started" && (
                <CountryConsentForm onSubmit={handleStart} isPending={isPending}/>
            )}

            {status === "pending" && (
                <button
                    onClick={() =>
                        handleStart(
                            (account?.dac7_country_residence as "BE" | "FR") ?? "BE"
                        )
                    }
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending ? "Redirection…" : "Continuer le KYC sur Stripe →"}
                </button>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

// =============================================================================
// CountryConsentForm — sélection pays + CGU vendeur
// =============================================================================
function CountryConsentForm({
                                onSubmit,
                                isPending,
                            }: {
    onSubmit: (country: "BE" | "FR") => void;
    isPending: boolean;
}) {
    const [country, setCountry] = useState<"BE" | "FR">("BE");
    const [accepted, setAccepted] = useState(false);

    return (

        <form
            onSubmit={(e) => {
                e.preventDefault();
                if (!accepted) return;
                onSubmit(country);
            }}
            className="space-y-6 max-w-xl"
        >
            <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Étape 1/2
                </p>
                <h2 className="mt-2 font-display text-2xl tracking-tight">
                    Démarrer le KYC
                </h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Tu seras redirigé vers Stripe pour vérifier ton identité.
                    Compte ~5 minutes.
                </p>
            </div>

            <label className="block">
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Pays de résidence fiscale *
                </span>
                <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value as "BE" | "FR")}
                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent cursor-pointer"
                >
                    <option value="BE">Belgique</option>
                    <option value="FR">France</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                    Non modifiable après création du compte Stripe.
                </p>
            </label>

            <label className="flex items-start gap-3 cursor-pointer text-sm">
                <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 accent-accent"
                />
                <span className="text-foreground/80 leading-relaxed">
                    J&apos;accepte les{" "}
                    <a
                        href="/cgu-vendeur"
                        target="_blank"
                        className="text-accent hover:underline"
                    >
                        conditions de vente Sente
                    </a>{" "}
                    et je certifie vendre en tant que particulier non-professionnel.
            </span>
            </label>

            <button
                type="submit"
                disabled={!accepted || isPending}
                className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
            >
                {isPending ? "Création du compte…" : "Démarrer le KYC sur Stripe →"}
            </button>
        </form>
    )
        ;
}

// =============================================================================
// TinForm — saisie infos DAC7 après KYC Stripe complet
// =============================================================================
function TinForm() {
    const router = useRouter();
    const [tin, setTin] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [addressFull, setAddressFull] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            const result = await submitDac7Info({
                tin: tin.trim(),
                birth_date: birthDate,
                address_full: addressFull.trim(),
            });
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            router.refresh();
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
            <label className="block">
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Numéro fiscal *
                </span>
                <input
                    type="text"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="NN belge ou n° fiscal français"
                    required
                    minLength={8}
                    maxLength={50}
                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
            </label>

            <label className="block">
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Date de naissance *
                </span>
                <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    required
                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
            </label>

            <label className="block">
                <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Adresse postale complète *
                </span>
                <textarea
                    value={addressFull}
                    onChange={(e) => setAddressFull(e.target.value)}
                    placeholder="Rue, n°, code postal, ville, pays"
                    required
                    minLength={10}
                    maxLength={500}
                    rows={3}
                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
                />
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
                type="submit"
                disabled={
                    isPending ||
                    tin.trim().length < 8 ||
                    !birthDate ||
                    addressFull.trim().length < 10
                }
                className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
            >
                {isPending ? "Enregistrement…" : "Valider mon KYC"}
            </button>
        </form>
    );
}