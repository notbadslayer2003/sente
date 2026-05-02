"use client";

import { useState, useTransition } from "react";
import { deleteMyAccountAction } from "@/app/actions/profile";

export function DeleteAccountSection({ email }: { email: string }) {
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
            const r = await deleteMyAccountAction(fd);
            // Si succès, redirect() côté serveur, on n'arrive pas ici.
            if (!r.ok) setError(r.error);
        });
    };

    return (
        <div className="border border-destructive/30 bg-destructive/5 p-8">
            <h2 className="font-display text-xl tracking-tight text-destructive">
                Zone sensible
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Supprimer ton compte. Tes données personnelles seront marquées
                supprimées immédiatement et purgées définitivement après 30 jours.
                Tu peux annuler en te reconnectant durant cette période.
            </p>

            {!open && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="mt-6 border border-destructive text-destructive hover:bg-destructive hover:text-background transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium"
                >
                    Supprimer mon compte
                </button>
            )}

            {open && (
                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                    <p className="text-sm">
                        Tu es sur le point de supprimer le compte associé à{" "}
                        <strong>{email}</strong>. Tape <strong>SUPPRIMER</strong> en
                        majuscules pour confirmer.
                    </p>
                    <input
                        type="text"
                        name="confirmation"
                        placeholder="SUPPRIMER"
                        autoComplete="off"
                        className="w-full bg-background border border-destructive/50 px-4 py-3 text-sm focus:outline-none focus:border-destructive"
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="bg-destructive text-background hover:bg-destructive/90 transition-colors px-5 py-2.5 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                        >
                            {isPending ? "Suppression..." : "Confirmer la suppression"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                setError(null);
                            }}
                            disabled={isPending}
                            className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Annuler
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}