"use client";

import { useState, useTransition } from "react";
import {
    addPosteAction,
    updatePosteAction,
    deletePosteAction,
    togglePostesAttribuesAction,
} from "@/app/actions/postes";

type Poste = {
    id: string;
    numero: string;
    label: string | null;
    description: string | null;
    active: boolean;
};

export function PostesManager({
                                  orgId,
                                  attribuesActifs,
                                  postesCount,
                                  postes,
                              }: {
    orgId: string;
    attribuesActifs: boolean;
    postesCount: number;
    postes: Poste[];
}) {
    return (
        <div className="space-y-12">
            <ToggleSection orgId={orgId} initialEnabled={attribuesActifs} />
            <PostesList orgId={orgId} initialPostes={postes} totalCount={postesCount} />
        </div>
    );
}

function ToggleSection({
                           orgId,
                           initialEnabled,
                       }: {
    orgId: string;
    initialEnabled: boolean;
}) {
    const [enabled, setEnabled] = useState(initialEnabled);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const onToggle = () => {
        setError(null);
        const newValue = !enabled;
        const fd = new FormData();
        fd.set("org_id", orgId);
        fd.set("enabled", newValue ? "true" : "false");
        startTransition(async () => {
            const r = await togglePostesAttribuesAction(fd);
            if (r.ok) setEnabled(newValue);
            else setError(r.error);
        });
    };

    return (
        <div className="border border-border bg-secondary/20 p-6 flex items-start gap-4 justify-between">
            <div>
                <p className="font-display text-lg leading-tight">
                    Postes attribués {enabled ? "actifs" : "désactivés"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xl">
                    Active si tu numérotes des emplacements de pêche et que tu les
                    attribues à tes pêcheurs (annuel ou journée). Désactive si tu
                    fonctionnes en libre.
                </p>
                {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            </div>
            <button
                type="button"
                onClick={onToggle}
                disabled={isPending}
                className={`shrink-0 px-5 py-2.5 text-xs uppercase tracking-wide font-medium transition-colors disabled:opacity-50 ${
                    enabled
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-foreground hover:bg-foreground hover:text-background"
                }`}
            >
                {isPending ? "..." : enabled ? "Désactiver" : "Activer"}
            </button>
        </div>
    );
}

function PostesList({
                        orgId,
                        initialPostes,
                        totalCount,
                    }: {
    orgId: string;
    initialPostes: Poste[];
    totalCount: number;
}) {
    const [postes, setPostes] = useState<Poste[]>(initialPostes);
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl tracking-tight">
                    Liste des postes ({postes.filter((p) => p.active).length} actifs / {postes.length} total)
                </h2>
                {!adding && (
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium"
                    >
                        + Ajouter
                    </button>
                )}
            </div>

            {adding && (
                <PosteForm
                    orgId={orgId}
                    mode="create"
                    onSuccess={(newPoste) => {
                        setPostes((prev) => [...prev, newPoste].sort((a, b) =>
                            a.numero.localeCompare(b.numero, "fr", { numeric: true })
                        ));
                        setAdding(false);
                    }}
                    onCancel={() => setAdding(false)}
                />
            )}

            {postes.length === 0 && !adding ? (
                <div className="border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        Aucun poste configuré. Clique sur « + Ajouter » pour commencer.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-border border-y border-border">
                    {postes.map((poste) =>
                        editingId === poste.id ? (
                            <li key={poste.id} className="py-5">
                                <PosteForm
                                    orgId={orgId}
                                    mode="edit"
                                    initial={poste}
                                    onSuccess={(updated) => {
                                        setPostes((prev) =>
                                            prev.map((p) => (p.id === updated.id ? updated : p))
                                        );
                                        setEditingId(null);
                                    }}
                                    onCancel={() => setEditingId(null)}
                                />
                            </li>
                        ) : (
                            <PosteRow
                                key={poste.id}
                                orgId={orgId}
                                poste={poste}
                                onEdit={() => setEditingId(poste.id)}
                                onDelete={() => {
                                    setPostes((prev) => prev.filter((p) => p.id !== poste.id));
                                }}
                            />
                        )
                    )}
                </ul>
            )}
        </div>
    );
}

function PosteRow({
                      orgId,
                      poste,
                      onEdit,
                      onDelete,
                  }: {
    orgId: string;
    poste: Poste;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const onDeleteClick = () => {
        if (!window.confirm(`Supprimer le poste "${poste.numero}" ? Si des abonnements sont liés, ils perdront cette référence.`))
            return;
        setError(null);
        const fd = new FormData();
        fd.set("id", poste.id);
        fd.set("etang_id", orgId);
        startTransition(async () => {
            const r = await deletePosteAction(fd);
            if (r.ok) onDelete();
            else setError(r.error);
        });
    };

    return (
        <li className="py-4 flex items-start justify-between gap-4">
            <div className="flex-1">
                <div className="flex items-center gap-3">
                    <span className="font-display text-lg">{poste.numero}</span>
                    {!poste.active && (
                        <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground px-2 py-0.5">
              Inactif
            </span>
                    )}
                </div>
                {poste.label && (
                    <p className="text-sm text-foreground mt-1">{poste.label}</p>
                )}
                {poste.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                        {poste.description}
                    </p>
                )}
                {error && <p className="text-xs text-destructive mt-2">{error}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={onEdit}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors disabled:opacity-50"
                >
                    Éditer
                </button>
                <button
                    type="button"
                    onClick={onDeleteClick}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                    Supprimer
                </button>
            </div>
        </li>
    );
}

function PosteForm({
                       orgId,
                       mode,
                       initial,
                       onSuccess,
                       onCancel,
                   }: {
    orgId: string;
    mode: "create" | "edit";
    initial?: Poste;
    onSuccess: (poste: Poste) => void;
    onCancel: () => void;
}) {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set("etang_id", orgId);
        if (mode === "edit" && initial) formData.set("id", initial.id);

        const optimistic: Poste = {
            id: initial?.id ?? crypto.randomUUID(),
            numero: (formData.get("numero") as string) ?? "",
            label: ((formData.get("label") as string) || "").trim() || null,
            description: ((formData.get("description") as string) || "").trim() || null,
            active: formData.get("active") === "on",
        };

        setError(null);
        startTransition(async () => {
            const r =
                mode === "create"
                    ? await addPosteAction(formData)
                    : await updatePosteAction(formData);
            if (r.ok) onSuccess(optimistic);
            else setError(r.error);
        });
    };

    return (
        <form
            onSubmit={onSubmit}
            className="border border-border bg-secondary/20 p-6 space-y-5"
        >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Numéro *
            </span>
                        <input
                            type="text"
                            name="numero"
                            required
                            defaultValue={initial?.numero ?? ""}
                            placeholder="Ex: 1, 2A, B7..."
                            className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent"
                        />
                    </label>
                </div>
                <div className="sm:col-span-2">
                    <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Nom (optionnel)
            </span>
                        <input
                            type="text"
                            name="label"
                            defaultValue={initial?.label ?? ""}
                            placeholder="Ex: Berge nord, Plat de bois..."
                            className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent"
                        />
                    </label>
                </div>
            </div>

            <label className="block">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Description (optionnel)
        </span>
                <textarea
                    name="description"
                    defaultValue={initial?.description ?? ""}
                    rows={2}
                    placeholder="Ex: Profondeur 3m, fond vaseux, accès véhicule..."
                    className="mt-2 w-full bg-background border border-border px-4 py-3 text-sm focus:outline-none focus:border-accent resize-y"
                />
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                    type="checkbox"
                    name="active"
                    defaultChecked={initial?.active ?? true}
                    className="accent-[var(--accent)]"
                />
                <span>Poste actif (visible et attribuable)</span>
            </label>

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending
                        ? "Enregistrement..."
                        : mode === "create"
                            ? "Créer le poste"
                            : "Enregistrer"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Annuler
                </button>
            </div>
        </form>
    );
}