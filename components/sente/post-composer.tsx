"use client";

import Image from "next/image";
import { useState, useTransition, useRef, useEffect } from "react";
import { createPostAction } from "@/app/actions/posts";
import { uploadPostPhotoAction } from "@/app/actions/post-photos";
import { searchOrgsAction } from "@/app/actions/orgs-search";
import { compressImage } from "@/lib/utils/image-compress";

type MyOrg = { id: string; name: string; slug: string; org_type: string };
type OrgSearchResult = {
    id: string;
    slug: string;
    name: string;
    org_type: string;
    city: string | null;
};

const ESPECES = [
    { value: "", label: "Aucune" },
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
    { value: "carnassier", label: "Carnassier" },
    { value: "blanc", label: "Blanc" },
    { value: "salmonide", label: "Salmonidé" },
];

export function PostComposer({
                                 myOrgs,
                                 onClose,
                                 onSuccess,
                             }: {
    myOrgs: MyOrg[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [content, setContent] = useState("");
    const [authorOrgId, setAuthorOrgId] = useState<string>(""); // "" = post en tant que user
    const [photos, setPhotos] = useState<string[]>([]);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [espece, setEspece] = useState("");
    const [weightKg, setWeightKg] = useState("");
    const [matos, setMatos] = useState("");
    const [mentions, setMentions] = useState<OrgSearchResult[]>([]);
    const [showMentionSearch, setShowMentionSearch] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ESC pour fermer
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        if (photos.length + files.length > 5) {
            setError("Max 5 photos par post.");
            return;
        }
        setError(null);
        setPhotoUploading(true);

        try {
            for (const file of files) {
                const compressed = await compressImage(file, {
                    maxWidth: 1500,
                    quality: 0.85,
                });
                const fd = new FormData();
                fd.set("file", compressed);
                const r = await uploadPostPhotoAction(fd);
                if (r.ok && r.data) {
                    setPhotos((p) => [...p, r.data!.url]);
                } else if (!r.ok) {
                    setError(r.error);
                    break;
                }
            }
        } catch (err) {
            console.error(err);
            setError("Erreur d'upload de photo.");
        } finally {
            setPhotoUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const onRemovePhoto = (url: string) => {
        setPhotos((p) => p.filter((u) => u !== url));
    };

    const onAddMention = (org: OrgSearchResult) => {
        if (mentions.length >= 5) {
            setError("Max 5 mentions.");
            return;
        }
        if (!mentions.find((m) => m.id === org.id)) {
            setMentions((m) => [...m, org]);
        }
        setShowMentionSearch(false);
    };

    const onRemoveMention = (id: string) => {
        setMentions((m) => m.filter((mm) => mm.id !== id));
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        if (!content.trim()) {
            setError("Le post ne peut pas être vide.");
            return;
        }

        const fd = new FormData();
        if (authorOrgId) fd.set("author_org_id", authorOrgId);
        fd.set("content", content);
        for (const url of photos) fd.append("photos", url);
        if (espece) fd.set("espece", espece);
        if (weightKg) fd.set("weight_kg", weightKg);
        if (matos.trim()) fd.set("matos", matos.trim());
        for (const m of mentions) fd.append("mentioned_org_ids", m.id);

        startTransition(async () => {
            const r = await createPostAction(fd);
            if (r.ok) onSuccess();
            else setError(r.error);
        });
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6">
            <div className="bg-background border border-border w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto">
                <header className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <h2 className="font-display text-lg tracking-tight">Nouveau post</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Fermer (Esc)
                    </button>
                </header>

                <form onSubmit={onSubmit} className="p-6 space-y-5">
                    {/* Choix de l'auteur si user a des orgs */}
                    {myOrgs.length > 0 && (
                        <label className="block">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Poster en tant que
              </span>
                            <select
                                value={authorOrgId}
                                onChange={(e) => setAuthorOrgId(e.target.value)}
                                className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent cursor-pointer"
                            >
                                <option value="">Moi</option>
                                {myOrgs.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {/* Contenu texte */}
                    <label className="block">
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Quoi de neuf ?
            </span>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={4}
                            maxLength={4000}
                            required
                            placeholder="Ta session, tes prises, tes anecdotes..."
                            className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
                        />
                        <span className="text-[10px] text-muted-foreground mt-1 block">
              {content.length} / 4000
            </span>
                    </label>

                    {/* Photos */}
                    <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">
              Photos ({photos.length}/5)
            </span>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            {photos.map((url) => (
                                <div
                                    key={url}
                                    className="relative aspect-square bg-secondary border border-border"
                                >
                                    <Image
                                        src={url}
                                        alt="Aperçu"
                                        fill
                                        sizes="200px"
                                        className="object-cover"
                                        unoptimized
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onRemovePhoto(url)}
                                        className="absolute top-1 right-1 w-6 h-6 bg-destructive text-background flex items-center justify-center text-xs hover:bg-destructive/80 transition-colors"
                                        aria-label="Retirer"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                            {photos.length < 5 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={photoUploading}
                                    className="aspect-square bg-secondary border border-dashed border-border hover:border-accent transition-colors flex items-center justify-center text-muted-foreground hover:text-accent disabled:opacity-50"
                                >
                                    {photoUploading ? "..." : "+ Photo"}
                                </button>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={onPickFile}
                            className="hidden"
                        />
                    </div>

                    {/* Métadonnées prise (compactes) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="block">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Espèce
              </span>
                            <select
                                value={espece}
                                onChange={(e) => setEspece(e.target.value)}
                                className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent cursor-pointer"
                            >
                                {ESPECES.map((e) => (
                                    <option key={e.value} value={e.value}>
                                        {e.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Poids (kg)
              </span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="999.99"
                                value={weightKg}
                                onChange={(e) => setWeightKg(e.target.value)}
                                placeholder="ex: 12.50"
                                className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                            />
                        </label>
                        <label className="block">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Matos
              </span>
                            <input
                                type="text"
                                value={matos}
                                onChange={(e) => setMatos(e.target.value)}
                                maxLength={100}
                                placeholder="ex: Korda Kaptor 12ft 3lb"
                                className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                            />
                        </label>
                    </div>

                    {/* Mentions étangs/magasins */}
                    <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-2">
              Tagger un étang / magasin ({mentions.length}/5)
            </span>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {mentions.map((m) => (
                                <span
                                    key={m.id}
                                    className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/30 px-2 py-1"
                                >
                  {m.name}
                                    <button
                                        type="button"
                                        onClick={() => onRemoveMention(m.id)}
                                        className="ml-1 hover:text-destructive"
                                        aria-label="Retirer"
                                    >
                    ×
                  </button>
                </span>
                            ))}
                        </div>
                        {!showMentionSearch && mentions.length < 5 && (
                            <button
                                type="button"
                                onClick={() => setShowMentionSearch(true)}
                                className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                            >
                                + Tagger
                            </button>
                        )}
                        {showMentionSearch && (
                            <MentionSearch
                                onSelect={onAddMention}
                                onCancel={() => setShowMentionSearch(false)}
                            />
                        )}
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    {/* Submit */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isPending}
                            className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isPending || photoUploading}
                            className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                        >
                            {isPending ? "Publication..." : "Publier"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function MentionSearch({
                           onSelect,
                           onCancel,
                       }: {
    onSelect: (org: OrgSearchResult) => void;
    onCancel: () => void;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<OrgSearchResult[]>([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }
        const timeout = setTimeout(async () => {
            setSearching(true);
            const fd = new FormData();
            fd.set("query", query);
            const r = await searchOrgsAction(fd);
            if (r.ok && r.data) setResults(r.data.results);
            setSearching(false);
        }, 250);
        return () => clearTimeout(timeout);
    }, [query]);

    return (
        <div className="border border-border bg-background p-3 space-y-2">
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tape le nom de l'étang/magasin..."
                    autoFocus
                    className="flex-1 bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                >
                    Annuler
                </button>
            </div>
            {searching && (
                <p className="text-xs text-muted-foreground">Recherche...</p>
            )}
            {!searching && query.length >= 2 && results.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun résultat.</p>
            )}
            <ul className="space-y-1">
                {results.map((r) => (
                    <li key={r.id}>
                        <button
                            type="button"
                            onClick={() => onSelect(r)}
                            className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors text-sm"
                        >
                            <span className="font-medium">{r.name}</span>
                            {r.city && (
                                <span className="text-xs text-muted-foreground ml-2">
                  {r.city}
                </span>
                            )}
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground ml-2">
                {r.org_type === "etang" ? "Étang" : "Magasin"}
              </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}