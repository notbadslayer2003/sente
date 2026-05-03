"use client";

import { useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { createReportAction } from "@/app/actions/reports";

const REASONS = [
    { value: "spam", label: "Spam ou contenu commercial non sollicité" },
    { value: "harassment", label: "Harcèlement ou insultes" },
    { value: "inappropriate", label: "Contenu inapproprié" },
    { value: "misinfo", label: "Informations trompeuses" },
    { value: "other", label: "Autre" },
];

export function ReportButton({
                                 targetType,
                                 targetId,
                                 isLoggedIn,
                                 size = "default",
                             }: {
    targetType: "post" | "comment";
    targetId: string;
    isLoggedIn: boolean;
    size?: "default" | "sm";
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState<string>("");
    const [detail, setDetail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isPending, startTransition] = useTransition();

    const onClick = () => {
        if (!isLoggedIn) {
            window.location.href =
                "/login?next=" + encodeURIComponent(window.location.pathname);
            return;
        }
        setOpen(true);
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!reason) {
            setError("Choisis un motif.");
            return;
        }
        setError(null);

        const fd = new FormData();
        fd.set("target_type", targetType);
        fd.set("target_id", targetId);
        fd.set("reason", reason);
        if (detail.trim()) fd.set("detail", detail.trim());

        startTransition(async () => {
            const r = await createReportAction(fd);
            if (r.ok) {
                setSuccess(true);
                setTimeout(() => {
                    setOpen(false);
                    setSuccess(false);
                    setReason("");
                    setDetail("");
                }, 2000);
            } else {
                setError(r.error);
            }
        });
    };

    const buttonClass =
        size === "sm"
            ? "p-1 hover:bg-secondary rounded-full transition-colors"
            : "flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors";

    return (
        <>
            <button
                type="button"
                onClick={onClick}
                aria-label="Signaler"
                className={buttonClass}
            >
                <Flag
                    className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"}
                    strokeWidth={2}
                />
                {size !== "sm" && <span>Signaler</span>}
            </button>

            {open && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
                    <div className="bg-background border border-border max-w-md w-full">
                        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-display text-lg tracking-tight">Signaler</h3>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                disabled={isPending}
                                className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Fermer
                            </button>
                        </header>

                        {success ? (
                            <div className="p-6 text-center">
                                <p className="text-sm text-primary">
                                    Merci, le signalement a bien été reçu.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={onSubmit} className="p-6 space-y-4">
                                <div>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground block mb-3">
                    Motif
                  </span>
                                    <div className="space-y-2">
                                        {REASONS.map((r) => (
                                            <label
                                                key={r.value}
                                                className="flex items-start gap-3 cursor-pointer"
                                            >
                                                <input
                                                    type="radio"
                                                    name="reason"
                                                    value={r.value}
                                                    checked={reason === r.value}
                                                    onChange={(e) => setReason(e.target.value)}
                                                    className="mt-1 cursor-pointer"
                                                />
                                                <span className="text-sm leading-tight">{r.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Détails (optionnel)
                  </span>
                                    <textarea
                                        value={detail}
                                        onChange={(e) => setDetail(e.target.value)}
                                        rows={3}
                                        maxLength={1000}
                                        placeholder="Précise si nécessaire..."
                                        className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent resize-y"
                                    />
                                </label>

                                {error && <p className="text-sm text-destructive">{error}</p>}

                                <div className="flex items-center justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        disabled={isPending}
                                        className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isPending || !reason}
                                        className="bg-destructive text-background hover:bg-destructive/90 transition-colors px-4 py-2 text-xs uppercase tracking-wide font-medium disabled:opacity-50"
                                    >
                                        {isPending ? "Envoi..." : "Envoyer le signalement"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}