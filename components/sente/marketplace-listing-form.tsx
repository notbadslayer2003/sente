"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    createListingDraft,
    updateListing,
    publishListing,
} from "@/app/actions/marketplace/listings";
import { MarketplaceListingAttributesFields } from "@/components/sente/marketplace-listing-attributes-fields";

// =============================================================================
// MarketplaceListingForm — create + edit avec verrouillage en mode 'active'
// =============================================================================

type Condition = "new_with_tag" | "new" | "very_good" | "good" | "acceptable";
type Country = "BE" | "FR";

const CONDITIONS: { value: Condition; label: string }[] = [
    { value: "new_with_tag", label: "Neuf avec étiquette" },
    { value: "new", label: "Neuf sans étiquette" },
    { value: "very_good", label: "Très bon état" },
    { value: "good", label: "Bon état" },
    { value: "acceptable", label: "Correct" },
];

type Attributes = Record<string, unknown>;

type Category = {
    id: string;
    slug: string;
    name_fr: string;
    parent_id: string | null;
    parent_slug?: string | null;
    parent_name?: string | null;
};

type Brand = { id: string; name: string };

export type ListingFormValues = {
    title: string;
    description: string;
    price_euros: number;
    category_id: string;
    brand_id: string | null;
    condition: Condition;
    weight_grams: number;
    length_cm: number | null;
    width_cm: number | null;
    depth_cm: number | null;
    city: string;
    postal_code: string;
    country: Country;
    attributes: Attributes;
};

// Classes input partagées
const INPUT_CLS =
    "mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed";
const SELECT_CLS = `${INPUT_CLS} cursor-pointer`;

export function MarketplaceListingForm({
                                           mode,
                                           listingId,
                                           listingStatus,
                                           canPublish,
                                           initialValues,
                                           categories,
                                           brands,
                                       }: Readonly<{
    mode: "create" | "edit";
    listingId?: string;
    listingStatus?: string;
    canPublish?: boolean;
    initialValues?: Partial<ListingFormValues>;
    categories: Category[];
    brands: Brand[];
}>) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const fieldsLocked = mode === "edit" && listingStatus === "active";

    const [values, setValues] = useState<ListingFormValues>({
        title: initialValues?.title ?? "",
        description: initialValues?.description ?? "",
        price_euros: initialValues?.price_euros ?? 0,
        category_id: initialValues?.category_id ?? "",
        brand_id: initialValues?.brand_id ?? null,
        condition: initialValues?.condition ?? "good",
        weight_grams: initialValues?.weight_grams ?? 0,
        length_cm: initialValues?.length_cm ?? null,
        width_cm: initialValues?.width_cm ?? null,
        depth_cm: initialValues?.depth_cm ?? null,
        city: initialValues?.city ?? "",
        postal_code: initialValues?.postal_code ?? "",
        country: initialValues?.country ?? "BE",
        attributes: initialValues?.attributes ?? {},
    });

    function update<K extends keyof ListingFormValues>(
        key: K,
        value: ListingFormValues[K]
    ) {
        setValues((v) => ({ ...v, [key]: value }));
    }

    function buildPayload() {
        return {
            title: values.title.trim(),
            description: values.description.trim(),
            price_cents: Math.round(values.price_euros * 100),
            category_id: values.category_id,
            brand_id: values.brand_id || null,
            condition: values.condition,
            weight_grams: Math.round(values.weight_grams),
            length_cm: values.length_cm,
            width_cm: values.width_cm,
            depth_cm: values.depth_cm,
            city: values.city.trim(),
            postal_code: values.postal_code.trim(),
            country: values.country,
            attributes: values.attributes,
        };
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            if (mode === "create") {
                const result = await createListingDraft(buildPayload());
                if (!result.ok) {
                    setError(result.error.message);
                    return;
                }
                router.push(`/profil/marketplace/annonces/${result.data.id}`);
            } else if (mode === "edit" && listingId) {
                // En mode edit + active, on n'envoie pas les champs verrouillés
                const payload = buildPayload();
                const editPayload: Record<string, unknown> = fieldsLocked
                    ? {
                        title: payload.title,
                        description: payload.description,
                        price_cents: payload.price_cents,
                        condition: payload.condition,
                        weight_grams: payload.weight_grams,
                        length_cm: payload.length_cm,
                        width_cm: payload.width_cm,
                        depth_cm: payload.depth_cm,
                    }
                    : payload;

                const result = await updateListing(listingId, editPayload);
                if (!result.ok) {
                    setError(result.error.message);
                    return;
                }
                router.refresh();
            }
        });
    }

    function handlePublish() {
        if (!listingId) return;
        startTransition(async () => {
            const result = await publishListing(listingId);
            if (!result.ok) {
                setError(result.error.message);
                return;
            }
            router.refresh();
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-12 max-w-3xl">
            {/* Bandeau verrouillage */}
            {fieldsLocked && (
                <div className="border border-accent/30 bg-accent/5 p-5">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                        Champs verrouillés
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">
                        Catégorie, marque et localisation sont verrouillées tant que
                        l&apos;annonce est en ligne. Dépublie-la pour les modifier.
                    </p>
                </div>
            )}

            {/* Description */}
            <Section title="Description">
                <Field label="Titre *">
                    <input
                        type="text"
                        value={values.title}
                        onChange={(e) => update("title", e.target.value)}
                        required
                        minLength={3}
                        maxLength={100}
                        placeholder="Ex : Canne carpe Daiwa Black Widow 12ft 3lbs"
                        className={INPUT_CLS}
                    />
                </Field>

                <Field label="Description *">
                    <textarea
                        value={values.description}
                        onChange={(e) => update("description", e.target.value)}
                        required
                        minLength={10}
                        maxLength={4000}
                        rows={5}
                        placeholder="État, dimensions, accessoires inclus, raison de la vente…"
                        className={`${INPUT_CLS} resize-y`}
                    />
                </Field>
            </Section>

            {/* Catégorie + marque */}
            <Section title="Catégorie & marque">
                <Field label="Catégorie *">
                    <select
                        value={values.category_id}
                        onChange={(e) => update("category_id", e.target.value)}
                        disabled={fieldsLocked}
                        required
                        className={SELECT_CLS}
                    >
                        <option value="">— Choisir —</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.parent_name ? `${c.parent_name} › ${c.name_fr}` : c.name_fr}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="Marque (optionnel)">
                    <select
                        value={values.brand_id ?? ""}
                        onChange={(e) => update("brand_id", e.target.value || null)}
                        disabled={fieldsLocked}
                        className={SELECT_CLS}
                    >
                        <option value="">— Aucune ou pas listée —</option>
                        {brands.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </Field>
            </Section>

            {/* État + prix */}
            <Section title="État & prix">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="État *">
                        <select
                            value={values.condition}
                            onChange={(e) => update("condition", e.target.value as Condition)}
                            required
                            className={SELECT_CLS}
                        >
                            {CONDITIONS.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Prix (€) *">
                        <input
                            type="number"
                            min="1"
                            max="10000"
                            step="0.01"
                            value={values.price_euros || ""}
                            onChange={(e) =>
                                update("price_euros", parseFloat(e.target.value) || 0)
                            }
                            required
                            className={INPUT_CLS}
                        />
                    </Field>
                </div>
            </Section>

            {/* Poids & dimensions */}
            <Section
                title="Poids & dimensions"
                subtitle="Pour le calcul automatique des frais d'envoi."
            >
                <Field label="Poids (grammes) *">
                    <input
                        type="number"
                        min="1"
                        max="30000"
                        step="1"
                        value={values.weight_grams || ""}
                        onChange={(e) =>
                            update("weight_grams", parseInt(e.target.value) || 0)
                        }
                        required
                        className={INPUT_CLS}
                    />
                </Field>

                <div className="grid grid-cols-3 gap-4">
                    <Field label="Longueur (cm)">
                        <input
                            type="number"
                            min="1"
                            max="200"
                            step="1"
                            value={values.length_cm ?? ""}
                            onChange={(e) =>
                                update(
                                    "length_cm",
                                    e.target.value ? parseInt(e.target.value) : null
                                )
                            }
                            className={INPUT_CLS}
                        />
                    </Field>
                    <Field label="Largeur (cm)">
                        <input
                            type="number"
                            min="1"
                            max="200"
                            step="1"
                            value={values.width_cm ?? ""}
                            onChange={(e) =>
                                update(
                                    "width_cm",
                                    e.target.value ? parseInt(e.target.value) : null
                                )
                            }
                            className={INPUT_CLS}
                        />
                    </Field>
                    <Field label="Hauteur (cm)">
                        <input
                            type="number"
                            min="1"
                            max="200"
                            step="1"
                            value={values.depth_cm ?? ""}
                            onChange={(e) =>
                                update(
                                    "depth_cm",
                                    e.target.value ? parseInt(e.target.value) : null
                                )
                            }
                            className={INPUT_CLS}
                        />
                    </Field>
                </div>
            </Section>

            {/* Caractéristiques spécifiques selon catégorie */}
            {values.category_id &&
                (() => {
                    const cat = categories.find((c) => c.id === values.category_id);
                    if (!cat) return null;
                    return (
                        <Section
                            title="Caractéristiques"
                            subtitle="Champs spécifiques à la catégorie sélectionnée."
                        >
                            <MarketplaceListingAttributesFields
                                categorySlug={cat.slug}
                                parentSlug={cat.parent_slug ?? null}
                                value={values.attributes}
                                onChange={(attrs) => update("attributes", attrs)}
                            />
                        </Section>
                    );
                })()}

            {/* Localisation */}
            <Section title="Localisation">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field label="Ville *">
                        <input
                            type="text"
                            value={values.city}
                            onChange={(e) => update("city", e.target.value)}
                            disabled={fieldsLocked}
                            required
                            minLength={2}
                            maxLength={100}
                            className={INPUT_CLS}
                        />
                    </Field>
                    <Field label="Code postal *">
                        <input
                            type="text"
                            value={values.postal_code}
                            onChange={(e) => update("postal_code", e.target.value)}
                            disabled={fieldsLocked}
                            required
                            minLength={4}
                            maxLength={10}
                            className={INPUT_CLS}
                        />
                    </Field>
                    <Field label="Pays *">
                        <select
                            value={values.country}
                            onChange={(e) => update("country", e.target.value as Country)}
                            disabled={fieldsLocked}
                            required
                            className={SELECT_CLS}
                        >
                            <option value="BE">Belgique</option>
                            <option value="FR">France</option>
                        </select>
                    </Field>
                </div>
            </Section>

            {/* Erreur */}
            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-4">
                    <p className="text-xs text-destructive">{error}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border pt-6">
                {mode === "edit" && canPublish && listingStatus === "draft" && (
                    <button
                        type="button"
                        onClick={handlePublish}
                        disabled={isPending}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                    >
                        Publier l&apos;annonce →
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending
                        ? "Enregistrement…"
                        : mode === "create"
                            ? "Créer le brouillon"
                            : "Enregistrer"}
                </button>
            </div>
        </form>
    );
}

// =============================================================================
// Helpers visuels
// =============================================================================

function Section({
                     title,
                     subtitle,
                     children,
                 }: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-5">
            <div>
                <h2 className="font-display text-xl tracking-tight">{title}</h2>
                {subtitle && (
                    <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
                )}
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

function Field({
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