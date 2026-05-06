"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, CircleAlert } from "lucide-react";
import {
    publishProductAction,
    archiveProductAction,
    unarchiveProductAction,
    softDeleteProductAction,
} from "@/app/actions/products";
import type { ProductDetail } from "@/lib/dal/products";

type Props = {
    slug: string;
    product: ProductDetail;
    onMutated: () => void;
    canPublish: boolean;
    publishReason: string | null;
};

export function ProductEditorHeader({
                                        slug,
                                        product,
                                        onMutated,
                                        canPublish,
                                        publishReason,
                                    }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Prérequis indépendants du plan (données produit)
    const hasActiveVariant = product.variants.some((v) => v.is_active);
    const hasPhoto = product.photos.length > 0;
    const missingItems: string[] = [];
    if (!hasActiveVariant) missingItems.push("au moins une variante active");
    if (!hasPhoto) missingItems.push("au moins une photo");

    // On peut tenter de publier si les prérequis produit sont remplis ET le plan l'autorise
    const canAttemptPublish = missingItems.length === 0 && canPublish;

    const onPublish = () => {
        if (!confirm("Publier ce produit ? Il sera visible sur ta vitrine.")) return;
        const fd = new FormData();
        fd.set("product_id", product.id);
        startTransition(async () => {
            setError(null);
            const r = await publishProductAction(fd);
            if (r.ok) onMutated();
            else setError(r.error);
        });
    };

    const onArchive = () => {
        if (
            !confirm(
                "Archiver ce produit ? Il ne sera plus visible mais tes commandes passées restent intactes."
            )
        )
            return;
        const fd = new FormData();
        fd.set("product_id", product.id);
        startTransition(async () => {
            setError(null);
            const r = await archiveProductAction(fd);
            if (r.ok) onMutated();
            else setError(r.error);
        });
    };

    const onUnarchive = () => {
        const fd = new FormData();
        fd.set("product_id", product.id);
        startTransition(async () => {
            setError(null);
            const r = await unarchiveProductAction(fd);
            if (r.ok) onMutated();
            else setError(r.error);
        });
    };

    const onDelete = () => {
        if (
            !confirm(
                "Supprimer définitivement ce produit ? Cette action est irréversible."
            )
        )
            return;
        const fd = new FormData();
        fd.set("product_id", product.id);
        startTransition(async () => {
            setError(null);
            const r = await softDeleteProductAction(fd);
            if (r.ok) {
                router.push(`/dashboard/${slug}/produits`);
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <header className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-border">
            {/* Titre + statut */}
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    {product.brand ? product.brand : "Produit"}
                </p>
                <h1 className="mt-2 font-display text-3xl tracking-tight">
                    {product.name}
                </h1>
                <div className="mt-3 flex items-center gap-3 text-xs">
                    <ProductStatusBadge status={product.status} />
                    <span className="text-muted-foreground">
                        /{product.organization.slug}/boutique/{product.slug}
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {product.status === "draft" && (
                    <>
                        {canAttemptPublish ? (
                            <button
                                onClick={onPublish}
                                disabled={isPending}
                                className="px-5 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50"
                            >
                                Publier
                            </button>
                        ) : !canPublish ? (
                            // Bloqué par le plan
                            <Link
                                href={`/dashboard/${slug}/parametres`}
                                title={publishReason ?? ""}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-wide border border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                            >
                                <Lock className="w-3 h-3" strokeWidth={1.75} />
                                Limite atteinte — Upgrade
                            </Link>
                        ) : (
                            // Bloqué par les prérequis produit
                            <button
                                disabled
                                title={`Il manque : ${missingItems.join(", ")}`}
                                className="px-5 py-2.5 text-xs uppercase tracking-wide bg-accent/30 text-accent-foreground/50 cursor-not-allowed"
                            >
                                Publier
                            </button>
                        )}
                        <button
                            onClick={onDelete}
                            disabled={isPending}
                            className="px-4 py-2.5 text-xs uppercase tracking-wide text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                            Supprimer
                        </button>
                    </>
                )}
                {product.status === "published" && (
                    <button
                        onClick={onArchive}
                        disabled={isPending}
                        className="px-4 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 transition-colors disabled:opacity-50"
                    >
                        Archiver
                    </button>
                )}
                {product.status === "archived" && (
                    <>
                        <button
                            onClick={onUnarchive}
                            disabled={isPending}
                            className="px-4 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 transition-colors disabled:opacity-50"
                        >
                            Réactiver
                        </button>
                        <button
                            onClick={onDelete}
                            disabled={isPending}
                            className="px-4 py-2.5 text-xs uppercase tracking-wide text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                            Supprimer
                        </button>
                    </>
                )}
            </div>

            {error && <p className="text-xs text-destructive w-full">{error}</p>}

            {/* Checklist de publication — visible seulement si brouillon et prérequis manquants */}
            {product.status === "draft" && missingItems.length > 0 && (
                <div className="w-full border border-border bg-secondary/20 p-4 flex items-start gap-3">
                    <CircleAlert
                        className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5"
                        strokeWidth={1.5}
                    />
                    <div>
                        <p className="text-xs text-muted-foreground">
                            Pour publier ce produit, il manque encore :
                        </p>
                        <ul className="mt-1.5 space-y-0.5">
                            {missingItems.map((item) => (
                                <li
                                    key={item}
                                    className="text-xs text-foreground flex items-center gap-1.5"
                                >
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground inline-block" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Banner plan gate — seulement si prérequis OK mais plan bloquant */}
            {product.status === "draft" &&
                missingItems.length === 0 &&
                !canPublish &&
                publishReason && (
                    <div className="w-full border border-accent/30 bg-accent/5 p-3 flex items-start gap-3">
                        <Lock
                            className="w-4 h-4 text-accent shrink-0 mt-0.5"
                            strokeWidth={1.75}
                        />
                        <p className="text-xs leading-relaxed">{publishReason}</p>
                    </div>
                )}
        </header>
    );
}

function ProductStatusBadge({
                                status,
                            }: {
    status: "draft" | "published" | "archived";
}) {
    const map = {
        draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
        published: { label: "Publié", className: "bg-primary/15 text-primary" },
        archived: {
            label: "Archivé",
            className: "bg-secondary text-muted-foreground",
        },
    } as const;
    const variant = map[status];
    return (
        <span
            className={`px-2 py-0.5 text-[10px] uppercase tracking-wide ${variant.className}`}
        >
            {variant.label}
        </span>
    );
}