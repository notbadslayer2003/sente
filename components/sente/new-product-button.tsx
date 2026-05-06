"use client";

import {useState, useEffect, useTransition} from "react";
import {useRouter} from "next/navigation";
import {createProductDraftAction} from "@/app/actions/products";
import {getCategoriesFlatAction} from "@/app/actions/product-categories";
import {CATEGORY_IDS} from "@/lib/constants/categories";

type Props = {
    organizationId: string;
    slug: string;
};

type ProductKind = "physical" | "gift_card";

export function NewProductButton({organizationId, slug}: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [kind, setKind] = useState<ProductKind>("physical");
    const [categories, setCategories] = useState<
        Array<{ id: string; label: string }>
    >([]);
    const [loadingCategories, setLoadingCategories] = useState(false);

    // Charge les catégories à l'ouverture (uniquement utile en mode physical,
    // mais on charge quand même pour pouvoir basculer rapidement)
    useEffect(() => {
        if (!open || categories.length > 0) return;
        setLoadingCategories(true);
        getCategoriesFlatAction()
            .then((cats) => setCategories(cats))
            .catch(() => setError("Erreur de chargement des catégories"))
            .finally(() => setLoadingCategories(false));
    }, [open, categories.length]);

    // Reset l'état à la fermeture
    const handleClose = () => {
        if (isPending) return;
        setOpen(false);
        setKind("physical");
        setError(null);
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);
        formData.set("organization_id", organizationId);
        formData.set("kind", kind);

        // Pré-sélection de la catégorie pour les bons cadeaux
        if (kind === "gift_card") {
            formData.set("category_id", CATEGORY_IDS.GIFT_CARDS);
        }

        startTransition(async () => {
            const r = await createProductDraftAction(formData);
            if (r.ok && r.data) {
                setOpen(false);
                setKind("physical");
                router.push(`/dashboard/${slug}/produits/${r.data.product_id}`);
                router.refresh();
            } else if (!r.ok) {
                setError(r.error);
            }
        });
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="px-5 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
            >
                Nouveau produit
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                    onClick={handleClose}
                >
                    <div
                        className="bg-background border border-border max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Création
                        </p>
                        <h2 className="mt-2 font-display text-2xl tracking-tight">
                            Nouveau produit
                        </h2>
                        <p className="mt-2 text-xs text-muted-foreground">
                            Crée un brouillon avec les infos de base. Tu pourras compléter
                            photos, variantes et prix juste après.
                        </p>

                        <form onSubmit={onSubmit} className="mt-6 space-y-5">
                            <Field label="Nom du produit" required>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    minLength={2}
                                    maxLength={150}
                                    placeholder={
                                        kind === "gift_card"
                                            ? "Carte cadeau pêche"
                                            : "Canne Korda Kaptor 12ft"
                                    }
                                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                    disabled={isPending}
                                />
                            </Field>

                            {/* Catégorie : visible seulement pour produits physiques */}
                            {kind === "physical" && (
                                <Field label="Catégorie" required>
                                    <select
                                        name="category_id"
                                        required
                                        className="w-full bg-background border border-border px-3 py-2 text-sm cursor-pointer focus:border-accent focus:outline-none"
                                        disabled={isPending || loadingCategories}
                                    >
                                        <option value="">
                                            {loadingCategories
                                                ? "Chargement..."
                                                : "— Choisis une catégorie —"}
                                        </option>
                                        {categories.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            )}

                            {/* Marque : optionnelle, masquée pour gift_card (peu pertinent) */}
                            {kind === "physical" && (
                                <Field label="Marque (optionnel)">
                                    <input
                                        name="brand"
                                        type="text"
                                        maxLength={80}
                                        placeholder="Korda, Daiwa, Shimano..."
                                        className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                        disabled={isPending}
                                    />
                                </Field>
                            )}

                            <Field label="Description courte (optionnel)">
                                <textarea
                                    name="short_desc"
                                    rows={2}
                                    maxLength={250}
                                    placeholder={
                                        kind === "gift_card"
                                            ? "À offrir à un proche pêcheur..."
                                            : "Résumé en une phrase pour les cards..."
                                    }
                                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
                                    disabled={isPending}
                                />
                            </Field>

                            {error && (
                                <p className="text-xs text-destructive">{error}</p>
                            )}

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isPending}
                                    className="px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        isPending ||
                                        (kind === "physical" && loadingCategories)
                                    }
                                    className="px-5 py-2 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                                >
                                    {isPending ? "Création..." : "Créer le brouillon"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

function KindOption({
                        active,
                        label,
                        description,
                        onClick,
                        disabled,
                    }: {
    active: boolean;
    label: string;
    description: string;
    onClick: () => void;
    disabled: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`text-left p-3 border transition-colors disabled:opacity-50 ${
                active
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/50"
            }`}
        >
            <p className="text-sm font-medium">{label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        </button>
    );
}

function Field({
                   label,
                   required,
                   children,
               }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </span>
            <div className="mt-1.5">{children}</div>
        </label>
    );
}