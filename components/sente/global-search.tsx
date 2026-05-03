"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import {
    globalSearchAction,
    type GlobalSearchResult,
} from "@/app/actions/global-search";

export function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GlobalSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Recherche debounced
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        const timeout = setTimeout(async () => {
            setSearching(true);
            const fd = new FormData();
            fd.set("query", query);
            const r = await globalSearchAction(fd);
            if (r.ok && r.data) setResults(r.data.results);
            setSearching(false);
        }, 250);
        return () => clearTimeout(timeout);
    }, [query]);

    // Focus auto à l'ouverture
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // ESC pour fermer
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Clic en dehors pour fermer
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        if (open) {
            window.addEventListener("mousedown", onClick);
            return () => window.removeEventListener("mousedown", onClick);
        }
    }, [open]);

    return (
        <div className="relative" ref={containerRef}>
            {!open ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Rechercher"
                    className="p-2 hover:bg-secondary transition-colors rounded-full"
                >
                    <Search className="w-4 h-4" strokeWidth={2} />
                </button>
            ) : (
                <div className="flex items-center gap-2 bg-background border border-border px-3 py-1.5 min-w-[280px]">
                    <Search
                        className="w-4 h-4 text-muted-foreground shrink-0"
                        strokeWidth={2}
                    />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Étangs, magasins, villes..."
                        className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            setQuery("");
                        }}
                        aria-label="Fermer"
                        className="p-1 hover:bg-secondary rounded-full"
                    >
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                </div>
            )}

            {/* Dropdown résultats */}
            {open && query.length >= 2 && (
                <div className="absolute right-0 top-full mt-1 w-[320px] sm:w-[400px] max-h-[480px] overflow-y-auto bg-background border border-border z-50">
                    {searching && (
                        <p className="px-4 py-3 text-xs text-muted-foreground">
                            Recherche...
                        </p>
                    )}
                    {!searching && results.length === 0 && (
                        <p className="px-4 py-3 text-xs text-muted-foreground">
                            Aucun résultat pour &quot;{query}&quot;.
                        </p>
                    )}
                    {!searching && results.length > 0 && (
                        <ul className="divide-y divide-border">
                            {results.map((r) => (
                                <li key={r.id}>
                                    <Link
                                        href={
                                            r.org_type === "etang"
                                                ? `/lieux/${r.slug}`
                                                : `/magasins/${r.slug}`
                                        }
                                        onClick={() => {
                                            setOpen(false);
                                            setQuery("");
                                        }}
                                        className="flex items-center gap-3 px-3 py-3 hover:bg-secondary transition-colors"
                                    >
                                        <div className="w-10 h-10 relative bg-secondary border border-border overflow-hidden shrink-0">
                                            {r.cover_image_url ? (
                                                <Image
                                                    src={r.cover_image_url}
                                                    alt={r.name}
                                                    fill
                                                    sizes="40px"
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                                                    {r.org_type === "etang" ? "ét" : "mag"}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-tight truncate">
                                                {r.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="uppercase tracking-wide text-[10px]">
                          {r.org_type === "etang" ? "Étang" : "Magasin"}
                        </span>
                                                {r.city && (
                                                    <span className="ml-2">{r.city}</span>
                                                )}
                                            </p>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}