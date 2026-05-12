"use client";

import Image from "next/image";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createEventAction, updateEventAction } from "@/app/actions/events";
import { uploadEventCoverAction } from "@/app/actions/event-photos";
import { compressImage } from "@/lib/utils/image-compress";
import type { EventDetail } from "@/lib/dal/events";

const EVENT_TYPES = [
    { value: "concours", label: "Concours" },
    { value: "journee_decouverte", label: "Journée découverte" },
    { value: "stage", label: "Stage" },
    { value: "assemblee", label: "Assemblée" },
    { value: "autre", label: "Autre" },
];

const ESPECES = [
    { value: "", label: "Aucune (généraliste)" },
    { value: "carpe", label: "Carpe" },
    { value: "silure", label: "Silure" },
    { value: "brochet", label: "Brochet" },
    { value: "sandre", label: "Sandre" },
    { value: "perche", label: "Perche" },
    { value: "truite", label: "Truite" },
    { value: "black_bass", label: "Black bass" },
    { value: "gardon", label: "Gardon" },
    { value: "tanche", label: "Tanche" },
    { value: "esturgeon", label: "Esturgeon" },
    { value: "salmonide", label: "Salmonidé" },
    { value: "carnassier", label: "Carnassier (général)" },
    { value: "blanc", label: "Blancs (général)" },
];

const NIVEAUX = [
    { value: "", label: "Non spécifié" },
    { value: "debutant", label: "Débutant" },
    { value: "intermediaire", label: "Intermédiaire" },
    { value: "expert", label: "Expert" },
    { value: "tous_niveaux", label: "Tous niveaux" },
];

export function EventForm({
                              organizationId,
                              dashboardSlug,
                              mode,
                              event,
                          }: {
    organizationId: string;
    dashboardSlug: string;
    mode: "create" | "edit";
    event?: EventDetail;
}) {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [coverUploading, setCoverUploading] = useState(false);

    // Form state
    const [title, setTitle] = useState(event?.title ?? "");
    const [description, setDescription] = useState(event?.description ?? "");
    const [eventType, setEventType] = useState(event?.event_type ?? "autre");
    const [startsAt, setStartsAt] = useState(toLocalInput(event?.starts_at));
    const [endsAt, setEndsAt] = useState(toLocalInput(event?.ends_at));
    const [locationText, setLocationText] = useState(event?.location_text ?? "");
    const [maxParticipants, setMaxParticipants] = useState(
        event?.max_participants?.toString() ?? ""
    );
    const [priceEur, setPriceEur] = useState(
        event ? (event.price_cents / 100).toString() : ""
    );
    const [commissionPct, setCommissionPct] = useState(
        event?.commission_rate_bps != null
            ? (event.commission_rate_bps / 100).toString()
            : ""
    );
    const [especeCible, setEspeceCible] = useState(event?.espece_cible ?? "");
    const [niveau, setNiveau] = useState(event?.niveau ?? "");
    const [materielFourni, setMaterielFourni] = useState(event?.materiel_fourni ?? "");
    const [materielAApporter, setMaterielAApporter] = useState(
        event?.materiel_a_apporter ?? ""
    );
    const [coverUrl, setCoverUrl] = useState(event?.cover_image_url ?? "");

    const onPickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError(null);
        setCoverUploading(true);
        try {
            const compressed = await compressImage(file, { maxWidth: 1500, quality: 0.85 });
            const fd = new FormData();
            fd.set("organization_id", organizationId);
            fd.set("file", compressed);
            const r = await uploadEventCoverAction(fd);
            if (r.ok && r.data) setCoverUrl(r.data.url);
            else if (!r.ok) setError(r.error);
        } catch (err) {
            console.error(err);
            setError("Erreur d'upload.");
        } finally {
            setCoverUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const submit = (publishNow: boolean) => {
        setError(null);
        const fd = new FormData();
        if (mode === "create") {
            fd.set("organization_id", organizationId);
            fd.set("publish_now", publishNow ? "true" : "false");
        } else if (event) {
            fd.set("event_id", event.id);
        }
        fd.set("title", title);
        fd.set("description", description);
        fd.set("event_type", eventType);
        fd.set("starts_at", new Date(startsAt).toISOString());
        if (endsAt) fd.set("ends_at", new Date(endsAt).toISOString());
        fd.set("location_text", locationText);
        if (maxParticipants) fd.set("max_participants", maxParticipants);
        fd.set("price_eur", priceEur || "0");
        if (commissionPct) fd.set("commission_rate_pct", commissionPct);
        if (especeCible) fd.set("espece_cible", especeCible);
        if (niveau) fd.set("niveau", niveau);
        fd.set("materiel_fourni", materielFourni);
        fd.set("materiel_a_apporter", materielAApporter);
        if (coverUrl) fd.set("cover_image_url", coverUrl);

        startTransition(async () => {
            const r =
                mode === "create"
                    ? await createEventAction(fd)
                    : await updateEventAction(fd);
            if (r.ok) {
                router.push(`/dashboard/${dashboardSlug}/evenements`);
                router.refresh();
            } else {
                setError(r.error);
            }
        });
    };

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                submit(false);
            }}
            className="space-y-8"
        >
            {/* Cover */}
            <div>
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">
          Image de couverture
        </span>
                {coverUrl ? (
                    <div className="relative aspect-[16/10] bg-secondary border border-border overflow-hidden mb-3">
                        <Image
                            src={coverUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, 600px"
                            className="object-cover"
                            unoptimized
                        />
                    </div>
                ) : (
                    <div className="aspect-[16/10] bg-secondary border border-dashed border-border flex items-center justify-center mb-3">
                        <p className="text-xs text-muted-foreground">Aucune image</p>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={coverUploading || isPending}
                    className="text-xs uppercase tracking-wide border border-border px-4 py-2 hover:bg-secondary transition-colors disabled:opacity-50"
                >
                    {coverUploading ? "Upload..." : coverUrl ? "Changer" : "Ajouter une cover"}
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={onPickCover}
                    className="hidden"
                />
            </div>

            {/* Type */}
            <Field label="Type d'événement">
                <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent cursor-pointer w-full"
                >
                    {EVENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </Field>

            <Field label="Titre *">
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    minLength={3}
                    maxLength={200}
                    required
                    placeholder="Ex: Concours carpe nuit du 15 août"
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
            </Field>

            <Field label="Description">
        <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder="Programme, règlement, ambiance..."
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
        />
                <p className="text-[10px] text-muted-foreground mt-1">
                    {description.length} / 4000
                </p>
            </Field>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Date de début *">
                    <input
                        type="datetime-local"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                        required
                        className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                </Field>
                <Field label="Date de fin (optionnel)">
                    <input
                        type="datetime-local"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                        className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                </Field>
            </div>

            <Field label="Lieu (texte libre)">
                <input
                    type="text"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    maxLength={300}
                    placeholder="Ex: Étang principal, Rendez-vous au club-house à 8h"
                    className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Capacité max">
                    <input
                        type="number"
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(e.target.value)}
                        min={1}
                        placeholder="Illimité si vide"
                        className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                </Field>
                <Field label="Prix (€)">
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={priceEur}
                        onChange={(e) => setPriceEur(e.target.value)}
                        placeholder="0 = gratuit"
                        className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Espèce ciblée">
                    <select
                        value={especeCible}
                        onChange={(e) => setEspeceCible(e.target.value)}
                        className="bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent cursor-pointer w-full"
                    >
                        {ESPECES.map((e) => (
                            <option key={e.value} value={e.value}>
                                {e.label}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label="Niveau">
                    <select
                        value={niveau}
                        onChange={(e) => setNiveau(e.target.value)}
                        className="bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent cursor-pointer w-full"
                    >
                        {NIVEAUX.map((n) => (
                            <option key={n.value} value={n.value}>
                                {n.label}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            <Field label="Matériel fourni">
        <textarea
            value={materielFourni}
            onChange={(e) => setMaterielFourni(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Ex: Cannes, moulinets, amorces fournis sur place..."
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
        />
            </Field>

            <Field label="À apporter">
        <textarea
            value={materielAApporter}
            onChange={(e) => setMaterielAApporter(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Ex: Bottes, gourde, repas du midi..."
            className="w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
        />
            </Field>

            {error && (
                <div className="border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-6 border-t border-border">
                {mode === "create" ? (
                    <>
                        <button
                            type="button"
                            onClick={() => submit(false)}
                            disabled={isPending || coverUploading}
                            className="text-xs uppercase tracking-wide border border-border px-4 py-2.5 hover:bg-secondary transition-colors disabled:opacity-50"
                        >
                            {isPending ? "..." : "Enregistrer en brouillon"}
                        </button>
                        <button
                            type="button"
                            onClick={() => submit(true)}
                            disabled={isPending || coverUploading}
                            className="text-xs uppercase tracking-wide bg-accent text-accent-foreground px-5 py-2.5 hover:bg-accent/90 transition-colors disabled:opacity-50 font-medium"
                        >
                            {isPending ? "..." : "Publier"}
                        </button>
                    </>
                ) : (
                    <button
                        type="submit"
                        disabled={isPending || coverUploading}
                        className="text-xs uppercase tracking-wide bg-accent text-accent-foreground px-5 py-2.5 hover:bg-accent/90 transition-colors disabled:opacity-50 font-medium"
                    >
                        {isPending ? "..." : "Enregistrer"}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => router.back()}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Annuler
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

function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}