"use client";

import { useState, useTransition } from "react";
import { updateProductInfoAction } from "@/app/actions/products";
import type { ProductDetail } from "@/lib/dal/products";
import type { ProductCategoryFlat } from "@/lib/dal/product-categories";

type Props = {
    product: ProductDetail;
    categories: ProductCategoryFlat[];
    onSaved: () => void;
};

export function ProductInfoSection({ product, categories, onSaved }: Props) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const isGiftCard = product.kind === "gift_card";

    const [name, setName] = useState(product.name);
    const [categoryId, setCategoryId] = useState(product.category.id);
    const [shortDesc, setShortDesc] = useState(product.short_desc ?? "");
    const [fullDesc, setFullDesc] = useState(product.full_desc ?? "");
    const [brand, setBrand] = useState(product.brand ?? "");
    const [tags, setTags] = useState<string[]>(product.tags);
    const [tagInput, setTagInput] = useState("");

    const addTag = () => {
        const t = tagInput.trim();
        if (!t) return;
        if (tags.includes(t)) return;
        if (tags.length >= 10) {
            setError("Maximum 10 tags");
            return;
        }
        setTags([...tags, t]);
        setTagInput("");
    };

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        const fd = new FormData();
        fd.set("product_id", product.id);
        fd.set("category_id", categoryId);
        fd.set("name", name);
        fd.set("short_desc", shortDesc);
        fd.set("full_desc", fullDesc);

        if (!isGiftCard) {
            fd.set("brand", brand);
            fd.set("tags", JSON.stringify(tags));
            // On passe les dimensions existantes inchangées — elles sont gérées
            // dans la section Variantes. Sans ça, la server action les réinitialiserait.
            fd.set("variant_dimensions", JSON.stringify(product.variant_dimensions));
        } else {
            fd.set("brand", "");
            fd.set("tags", JSON.stringify([]));
            fd.set("variant_dimensions", JSON.stringify([]));
        }

        startTransition(async () => {
            const r = await updateProductInfoAction(fd);
            if (r.ok) {
                setSuccess(true);
                onSaved();
                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {isGiftCard && (
                <div className="border border-accent/30 bg-accent/5 p-3">
                    <p className="text-xs">
                        <strong>Bon cadeau dématérialisé.</strong> La catégorie est fixée
                        automatiquement, et la gestion des marques/tags est simplifiée.
                        Définis le nom, la description et les valeurs proposées dans la
                        section Variantes.
                    </p>
                </div>
            )}

            <Field label="Nom du produit" required>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={150}
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
            </Field>

            {!isGiftCard && (
                <Field label="Catégorie" required>
                    <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        required
                        className="w-full bg-background border border-border px-3 py-2 text-sm cursor-pointer focus:border-accent focus:outline-none"
                    >
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                </Field>
            )}

            {!isGiftCard && (
                <Field label="Marque (optionnel)">
                    <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        maxLength={80}
                        className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                    />
                </Field>
            )}

            <Field
                label="Description courte"
                hint="Affichée sur les cards. Max 250 caractères."
            >
                <textarea
                    value={shortDesc}
                    onChange={(e) => setShortDesc(e.target.value)}
                    rows={2}
                    maxLength={250}
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none resize-none"
                />
                <span className="mt-1 block text-[10px] text-muted-foreground">
                    {shortDesc.length}/250
                </span>
            </Field>

            <Field
                label="Description complète"
                hint="Affichée sur la page détail produit. Max 8000 caractères."
            >
                <textarea
                    value={fullDesc}
                    onChange={(e) => setFullDesc(e.target.value)}
                    rows={6}
                    maxLength={8000}
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none resize-y"
                />
                <span className="mt-1 block text-[10px] text-muted-foreground">
                    {fullDesc.length}/8000
                </span>
            </Field>

            {!isGiftCard && (
                <Field
                    label="Tags (max 10)"
                    hint="Mots-clés libres pour aider à la recherche. Ex : 'made in France', 'gros poissons'."
                >
                    <div className="flex flex-wrap gap-2 mb-2">
                        {tags.map((t) => (
                            <span
                                key={t}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-secondary text-xs"
                            >
                                {t}
                                <button
                                    type="button"
                                    onClick={() => setTags(tags.filter((x) => x !== t))}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addTag();
                                }
                            }}
                            placeholder="Tape un tag puis Entrée..."
                            maxLength={40}
                            className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={addTag}
                            className="px-3 py-2 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                        >
                            Ajouter
                        </button>
                    </div>
                </Field>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
            {success && (
                <p className="text-xs text-primary">Informations enregistrées.</p>
            )}

            <div className="pt-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                    {isPending ? "Enregistrement..." : "Enregistrer les informations"}
                </button>
            </div>
        </form>
    );
}

function Field({
                   label,
                   required,
                   hint,
                   children,
               }: {
    label: string;
    required?: boolean;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </span>
            {hint && (
                <span className="mt-1 block text-[11px] text-muted-foreground">
                    {hint}
                </span>
            )}
            <div className="mt-1.5">{children}</div>
        </label>
    );
}