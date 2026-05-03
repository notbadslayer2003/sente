"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    addPecheurSubscriptionAction,
    updatePecheurSubscriptionAction,
    deletePecheurSubscriptionAction,
    exportRegistreCsvAction,
} from "@/app/actions/registre";
import { createPaymentLinkAction } from "@/app/actions/payments";

type Poste = {
    id: string;
    numero: string;
    label: string | null;
};

type Subscription = {
    id: string;
    pecheur_full_name: string;
    pecheur_email: string | null;
    pecheur_phone: string | null;
    saison_year: number;
    period_type: string;
    start_date: string;
    end_date: string;
    poste_id: string | null;
    poste_label: string | null;
    price_cents: number;
    paid_amount_cents: number;
    payment_method: string;
    payment_status: string;
    notes: string | null;
};

const PAYMENT_METHODS = [
    { value: "cash", label: "Cash" },
    { value: "virement", label: "Virement" },
    { value: "cheque", label: "Chèque" },
    { value: "online_card", label: "Carte (en ligne)" },
    { value: "autre", label: "Autre" },
];

const PAYMENT_STATUSES = [
    { value: "pending", label: "En attente" },
    { value: "partial", label: "Partiel" },
    { value: "paid", label: "Payé" },
    { value: "refunded", label: "Remboursé" },
    { value: "cancelled", label: "Annulé" },
    { value: "failed", label: "Échec" },
];

const PERIOD_TYPES = [
    { value: "annuel", label: "Annuel" },
    { value: "semestre", label: "Semestre" },
    { value: "trimestre", label: "Trimestre" },
    { value: "mensuel", label: "Mensuel" },
    { value: "autre", label: "Autre" },
];

export function RegistreManager({
                                    etangId,
                                    slug,
                                    selectedYear,
                                    availableYears,
                                    postes,
                                    subscriptions,
                                }: {
    etangId: string;
    slug: string;
    selectedYear: number;
    availableYears: number[];
    postes: Poste[];
    subscriptions: Subscription[];
}) {
    const router = useRouter();
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filter, setFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const filtered = subscriptions.filter((s) => {
        const matchSearch =
            !filter ||
            s.pecheur_full_name.toLowerCase().includes(filter.toLowerCase()) ||
            (s.pecheur_email?.toLowerCase().includes(filter.toLowerCase()) ?? false) ||
            (s.pecheur_phone?.includes(filter) ?? false);
        const matchStatus =
            statusFilter === "all" || s.payment_status === statusFilter;
        return matchSearch && matchStatus;
    });

    const onYearChange = (year: number) => {
        const params = new URLSearchParams();
        params.set("year", year.toString());
        router.push(`/dashboard/${slug}/registre?${params.toString()}`);
    };

    return (
        <div className="space-y-8">
            {/* Bandeau actions */}
            <div className="flex flex-wrap items-end justify-between gap-4 border border-border bg-secondary/20 p-5">
                <div className="flex flex-wrap items-end gap-4">
                    <label className="block">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Saison
            </span>
                        <select
                            value={selectedYear}
                            onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
                            className="mt-1 bg-background border border-border px-3 py-2 text-sm cursor-pointer"
                        >
                            {availableYears.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Recherche
            </span>
                        <input
                            type="text"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Nom, email, téléphone..."
                            className="mt-1 bg-background border border-border px-3 py-2 text-sm w-64"
                        />
                    </label>

                    <label className="block">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Statut
            </span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="mt-1 bg-background border border-border px-3 py-2 text-sm cursor-pointer"
                        >
                            <option value="all">Tous</option>
                            {PAYMENT_STATUSES.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="flex items-center gap-3">
                    <ExportButton etangId={etangId} year={selectedYear} />
                    {!adding && (
                        <button
                            type="button"
                            onClick={() => setAdding(true)}
                            className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium"
                        >
                            + Ajouter un pêcheur
                        </button>
                    )}
                </div>
            </div>

            {/* Form ajout */}
            {adding && (
                <SubscriptionForm
                    etangId={etangId}
                    selectedYear={selectedYear}
                    postes={postes}
                    mode="create"
                    onSuccess={() => {
                        setAdding(false);
                        router.refresh();
                    }}
                    onCancel={() => setAdding(false)}
                />
            )}

            {/* Liste */}
            {filtered.length === 0 ? (
                <div className="border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        {subscriptions.length === 0
                            ? "Aucun pêcheur enregistré pour cette saison. Clique sur « + Ajouter un pêcheur »."
                            : "Aucun pêcheur ne correspond à tes filtres."}
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-border border-y border-border">
                    {filtered.map((sub) =>
                        editingId === sub.id ? (
                            <li key={sub.id} className="py-5">
                                <SubscriptionForm
                                    etangId={etangId}
                                    selectedYear={selectedYear}
                                    postes={postes}
                                    mode="edit"
                                    initial={sub}
                                    onSuccess={() => {
                                        setEditingId(null);
                                        router.refresh();
                                    }}
                                    onCancel={() => setEditingId(null)}
                                />
                            </li>
                        ) : (
                            <SubscriptionRow
                                key={sub.id}
                                etangId={etangId}
                                sub={sub}
                                onEdit={() => setEditingId(sub.id)}
                                onDelete={() => router.refresh()}
                            />
                        )
                    )}
                </ul>
            )}
        </div>
    );
}

function SubscriptionRow({
                             etangId,
                             sub,
                             onEdit,
                             onDelete,
                         }: {
    etangId: string;
    sub: Subscription;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const remaining = (sub.price_cents - sub.paid_amount_cents) / 100;
    const canSendLink =
        !!sub.pecheur_email &&
        remaining > 0 &&
        sub.payment_status !== "paid" &&
        sub.payment_status !== "refunded" &&
        sub.payment_status !== "cancelled";

    const onSendLink = () => {
        if (
            !confirm(
                `Envoyer un lien de paiement à ${sub.pecheur_email} pour ${remaining.toFixed(0)} € ?`
            )
        )
            return;
        setError(null);
        setSuccess(null);
        const fd = new FormData();
        fd.set("subscription_id", sub.id);
        startTransition(async () => {
            const r = await createPaymentLinkAction(fd);
            if (r.ok) {
                setSuccess("Lien envoyé.");
                setTimeout(() => setSuccess(null), 4000);
            } else {
                setError(r.error);
            }
        });
    };

    const onDeleteClick = () => {
        if (
            !confirm(
                `Supprimer l'abonnement de ${sub.pecheur_full_name} ? Action irréversible.`
            )
        )
            return;
        setError(null);
        const fd = new FormData();
        fd.set("id", sub.id);
        fd.set("etang_id", etangId);
        startTransition(async () => {
            const r = await deletePecheurSubscriptionAction(fd);
            if (r.ok) onDelete();
            else setError(r.error);
        });
    };

    return (
        <li className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-5">
                <p className="font-display text-base leading-tight">
                    {sub.pecheur_full_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                    {sub.pecheur_email && <span>{sub.pecheur_email}</span>}
                    {sub.pecheur_email && sub.pecheur_phone && <span> · </span>}
                    {sub.pecheur_phone && <span>{sub.pecheur_phone}</span>}
                </p>
                {sub.poste_label && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Poste : <span className="text-foreground">{sub.poste_label}</span>
                    </p>
                )}
                {sub.notes && (
                    <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
                        {sub.notes}
                    </p>
                )}
            </div>
            <div className="lg:col-span-3 text-xs">
                <p className="text-muted-foreground">
                    {formatDate(sub.start_date)} → {formatDate(sub.end_date)}
                </p>
                <p className="text-muted-foreground mt-1 capitalize">{sub.period_type}</p>
            </div>
            <div className="lg:col-span-2">
                <p className="font-display text-base">
                    {(sub.paid_amount_cents / 100).toFixed(0)}€
                    <span className="text-xs text-muted-foreground">
            {" "}/ {(sub.price_cents / 100).toFixed(0)}€
          </span>
                </p>
                {remaining > 0 && (
                    <p className="text-xs text-destructive mt-0.5">
                        Reste {remaining.toFixed(0)}€
                    </p>
                )}
                <PaymentStatusBadge status={sub.payment_status} />
            </div>
            <div className="lg:col-span-2 flex flex-col gap-2 items-end">
                <div className="flex flex-wrap items-center gap-3 justify-end">
                    {canSendLink && (
                        <button
                            type="button"
                            onClick={onSendLink}
                            disabled={isPending}
                            className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                        >
                            Envoyer lien
                        </button>
                    )}
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
                {success && (
                    <p className="text-xs text-primary">{success}</p>
                )}
                {error && (
                    <p className="text-xs text-destructive">{error}</p>
                )}
            </div>
        </li>
    );
}

function PaymentStatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; className: string }> = {
        paid: { label: "Payé", className: "bg-primary/15 text-primary" },
        partial: {
            label: "Partiel",
            className: "bg-accent/15 text-accent",
        },
        pending: {
            label: "En attente",
            className: "bg-muted text-muted-foreground",
        },
        refunded: {
            label: "Remboursé",
            className: "bg-muted text-muted-foreground",
        },
        cancelled: {
            label: "Annulé",
            className: "bg-muted text-muted-foreground",
        },
        failed: {
            label: "Échec",
            className: "bg-destructive/15 text-destructive",
        },
    };
    const v = map[status] ?? map.pending;
    return (
        <span
            className={`mt-1 inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide ${v.className}`}
        >
      {v.label}
    </span>
    );
}

function SubscriptionForm({
                              etangId,
                              selectedYear,
                              postes,
                              mode,
                              initial,
                              onSuccess,
                              onCancel,
                          }: {
    etangId: string;
    selectedYear: number;
    postes: Poste[];
    mode: "create" | "edit";
    initial?: Subscription;
    onSuccess: () => void;
    onCancel: () => void;
}) {
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const defaultStart =
        initial?.start_date ?? `${selectedYear}-01-01`;
    const defaultEnd = initial?.end_date ?? `${selectedYear}-12-31`;

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("etang_id", etangId);
        if (mode === "edit" && initial) fd.set("id", initial.id);

        setError(null);
        startTransition(async () => {
            const r =
                mode === "create"
                    ? await addPecheurSubscriptionAction(fd)
                    : await updatePecheurSubscriptionAction(fd);
            if (r.ok) onSuccess();
            else setError(r.error);
        });
    };

    return (
        <form
            onSubmit={onSubmit}
            className="border border-border bg-secondary/20 p-6 space-y-6"
        >
            <h3 className="font-display text-lg tracking-tight">
                {mode === "create" ? "Nouvel abonnement" : "Modifier l'abonnement"}
            </h3>

            {/* Identité */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field
                    label="Nom complet *"
                    name="pecheur_full_name"
                    defaultValue={initial?.pecheur_full_name ?? ""}
                    required
                    placeholder="Jean Dupont"
                />
                <Field
                    label="Email"
                    name="pecheur_email"
                    type="email"
                    defaultValue={initial?.pecheur_email ?? ""}
                    placeholder="jean@exemple.com"
                />
                <Field
                    label="Téléphone"
                    name="pecheur_phone"
                    defaultValue={initial?.pecheur_phone ?? ""}
                />
            </div>

            {/* Période */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Field
                    label="Saison *"
                    name="saison_year"
                    type="number"
                    defaultValue={
                        initial?.saison_year?.toString() ?? selectedYear.toString()
                    }
                    required
                />
                <SelectField
                    label="Type *"
                    name="period_type"
                    defaultValue={initial?.period_type ?? "annuel"}
                    options={PERIOD_TYPES}
                />
                <Field
                    label="Début *"
                    name="start_date"
                    type="date"
                    defaultValue={defaultStart}
                    required
                />
                <Field
                    label="Fin *"
                    name="end_date"
                    type="date"
                    defaultValue={defaultEnd}
                    required
                />
            </div>

            {/* Poste */}
            {postes.length > 0 && (
                <SelectField
                    label="Poste attribué"
                    name="poste_id"
                    defaultValue={initial?.poste_id ?? "none"}
                    options={[
                        { value: "none", label: "Aucun" },
                        ...postes.map((p) => ({
                            value: p.id,
                            label: `${p.numero}${p.label ? ` — ${p.label}` : ""}`,
                        })),
                    ]}
                />
            )}

            {/* Paiement */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Field
                    label="Prix (€) *"
                    name="price_eur"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={
                        initial ? (initial.price_cents / 100).toFixed(2) : ""
                    }
                    required
                />
                <Field
                    label="Payé (€)"
                    name="paid_amount_eur"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={
                        initial ? (initial.paid_amount_cents / 100).toFixed(2) : "0"
                    }
                />
                <SelectField
                    label="Méthode *"
                    name="payment_method"
                    defaultValue={initial?.payment_method ?? "cash"}
                    options={PAYMENT_METHODS}
                />
                <SelectField
                    label="Statut *"
                    name="payment_status"
                    defaultValue={initial?.payment_status ?? "pending"}
                    options={PAYMENT_STATUSES}
                />
            </div>

            {/* Notes */}
            <label className="block">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Notes
        </span>
                <textarea
                    name="notes"
                    defaultValue={initial?.notes ?? ""}
                    rows={2}
                    placeholder="Ex: poste fixe préféré, allergique au foin, paye toujours en cash..."
                    className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
                />
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center gap-3 pt-2">
                <button
                    type="submit"
                    disabled={isPending}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                >
                    {isPending
                        ? "Enregistrement..."
                        : mode === "create"
                            ? "Créer l'abonnement"
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

function ExportButton({ etangId, year }: { etangId: string; year: number }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const onClick = () => {
        setError(null);
        const fd = new FormData();
        fd.set("etang_id", etangId);
        fd.set("saison_year", year.toString());
        startTransition(async () => {
            const r = await exportRegistreCsvAction(fd);
            if (r.ok && r.data) {
                downloadCsv(r.data.filename, r.data.content);
            } else if (!r.ok) {
                setError(r.error);
            }
        });
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                type="button"
                onClick={onClick}
                disabled={isPending}
                className="border border-foreground hover:bg-foreground hover:text-background transition-colors px-4 py-2.5 text-xs uppercase tracking-wide disabled:opacity-50"
            >
                {isPending ? "Export..." : "Export CSV"}
            </button>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

function downloadCsv(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function formatDate(d: string): string {
    const date = new Date(d);
    return date.toLocaleDateString("fr-BE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function Field({
                   label,
                   name,
                   type = "text",
                   defaultValue,
                   required = false,
                   step,
                   min,
                   placeholder,
               }: {
    label: string;
    name: string;
    type?: string;
    defaultValue?: string;
    required?: boolean;
    step?: string;
    min?: string;
    placeholder?: string;
}) {
    return (
        <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
            <input
                type={type}
                name={name}
                defaultValue={defaultValue}
                required={required}
                step={step}
                min={min}
                placeholder={placeholder}
                className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
        </label>
    );
}

function SelectField({
                         label,
                         name,
                         defaultValue,
                         options,
                     }: {
    label: string;
    name: string;
    defaultValue: string;
    options: { value: string; label: string }[];
}) {
    return (
        <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
            <select
                name={name}
                defaultValue={defaultValue}
                className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent cursor-pointer"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}