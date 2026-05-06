"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateShopSettingsAction } from "@/app/actions/shop-settings";
import { centsToEurInput, eurStringToCents } from "@/lib/utils/format";
import type { ShopSettings } from "@/lib/dal/shop-settings";

type Props = {
    organizationId: string;
    initialSettings: ShopSettings;
    canEdit: boolean;
};

export function ShopSettingsForm({
                                     organizationId,
                                     initialSettings,
                                     canEdit,
                                 }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // State local
    const [clickCollect, setClickCollect] = useState(
        initialSettings.click_collect_enabled
    );
    const [shippingStd, setShippingStd] = useState(
        initialSettings.shipping_standard_enabled
    );
    const [shippingStdFee, setShippingStdFee] = useState(
        centsToEurInput(initialSettings.shipping_standard_fee_cents)
    );
    const [shippingLocal, setShippingLocal] = useState(
        initialSettings.shipping_local_enabled
    );
    const [shippingLocalFee, setShippingLocalFee] = useState(
        centsToEurInput(initialSettings.shipping_local_fee_cents)
    );
    const [localZoneDesc, setLocalZoneDesc] = useState(
        initialSettings.shipping_local_zone_desc ?? ""
    );

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        const stdFeeCents = eurStringToCents(shippingStdFee);
        const localFeeCents = eurStringToCents(shippingLocalFee);

        if (shippingStd && stdFeeCents === null) {
            setError("Frais de livraison standard invalides");
            return;
        }
        if (shippingLocal && localFeeCents === null) {
            setError("Frais de livraison locale invalides");
            return;
        }

        const formData = new FormData();
        formData.set("organization_id", organizationId);
        formData.set("click_collect_enabled", String(clickCollect));
        formData.set("shipping_standard_enabled", String(shippingStd));
        formData.set(
            "shipping_standard_fee_cents",
            String(stdFeeCents ?? 0)
        );
        formData.set("shipping_local_enabled", String(shippingLocal));
        formData.set(
            "shipping_local_fee_cents",
            String(localFeeCents ?? 0)
        );
        formData.set("shipping_local_zone_desc", localZoneDesc);

        startTransition(async () => {
            const r = await updateShopSettingsAction(formData);
            if (r.ok) {
                setSuccess(true);
                router.refresh();
                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            {/* Click & collect */}
            <Section
                title="Click & Collect"
                description="Le client passe commande en ligne et vient retirer en magasin. Toujours gratuit."
            >
                <Toggle
                    checked={clickCollect}
                    onChange={setClickCollect}
                    label="Activer le retrait en magasin"
                    disabled={!canEdit}
                />
            </Section>

            {/* Livraison standard */}
            <Section
                title="Livraison standard"
                description="Envoi par transporteur (poste, GLS, etc.). Tu fixes ton forfait, valable pour toute commande."
            >
                <Toggle
                    checked={shippingStd}
                    onChange={setShippingStd}
                    label="Activer la livraison standard"
                    disabled={!canEdit}
                />
                {shippingStd && (
                    <PriceField
                        label="Frais de livraison"
                        value={shippingStdFee}
                        onChange={setShippingStdFee}
                        disabled={!canEdit}
                    />
                )}
            </Section>

            {/* Livraison locale */}
            <Section
                title="Livraison locale"
                description="Tu livres toi-même dans une zone géographique limitée (camionnette, vélo cargo...)."
            >
                <Toggle
                    checked={shippingLocal}
                    onChange={setShippingLocal}
                    label="Activer la livraison locale"
                    disabled={!canEdit}
                />
                {shippingLocal && (
                    <>
                        <PriceField
                            label="Frais de livraison locale"
                            value={shippingLocalFee}
                            onChange={setShippingLocalFee}
                            disabled={!canEdit}
                        />
                        <label className="block">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                Zone de livraison <span className="text-destructive">*</span>
                            </span>
                            <input
                                type="text"
                                value={localZoneDesc}
                                onChange={(e) => setLocalZoneDesc(e.target.value)}
                                maxLength={200}
                                placeholder="ex: Mons + 30 km, Province du Hainaut..."
                                disabled={!canEdit}
                                className="mt-1.5 w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
                            />
                            <span className="mt-1 block text-[11px] text-muted-foreground">
                                Décris ta zone pour que les clients sachent s'ils sont
                                éligibles.
                            </span>
                        </label>
                    </>
                )}
            </Section>

            {/* Feedback + submit */}
            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
            {success && (
                <p className="text-xs text-primary">Paramètres enregistrés.</p>
            )}

            {canEdit && (
                <div className="pt-4 border-t border-border">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="px-5 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                    >
                        {isPending ? "Enregistrement..." : "Enregistrer"}
                    </button>
                </div>
            )}
        </form>
    );
}

function Section({
                     title,
                     description,
                     children,
                 }: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="border border-border p-6 space-y-4">
            <div>
                <h3 className="font-display text-lg tracking-tight">{title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function Toggle({
                    checked,
                    onChange,
                    label,
                    disabled,
                }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <label className="flex items-center gap-3 cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 accent-accent cursor-pointer disabled:opacity-50"
            />
            <span className="text-sm">{label}</span>
        </label>
    );
}

function PriceField({
                        label,
                        value,
                        onChange,
                        disabled,
                    }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}) {
    return (
        <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {label}
            </span>
            <div className="mt-1.5 relative max-w-[200px]">
                <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    placeholder="0.00"
                    className="w-full bg-background border border-border pl-3 pr-10 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                </span>
            </div>
        </label>
    );
}