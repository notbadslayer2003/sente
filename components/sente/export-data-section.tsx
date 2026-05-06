"use client";

import { useState, useTransition } from "react";
import { exportUserDataAction } from "@/app/actions/profile";

export function ExportDataSection() {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const onExport = () => {
        setError(null);
        startTransition(async () => {
            const result = await exportUserDataAction();
            if (!result.ok) {
                setError(result.error);
                return;
            }
            // Déclenche le téléchargement côté client
            const blob = new Blob([result.data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `sente-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    };

    return (
        <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Mes données
            </p>
            <div className="border border-border px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-sm">Exporter mes données</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Télécharge un fichier JSON avec ton profil, tes commandes, tes
                        publications et l'historique de tes consentements (RGPD art. 20).
                    </p>
                </div>
                <button
                    onClick={onExport}
                    disabled={isPending}
                    className="shrink-0 px-4 py-2 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors disabled:opacity-50"
                >
                    {isPending ? "Préparation..." : "Télécharger"}
                </button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
    );
}