"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    dismissReportAction,
    hideReportPostAction,
    hideReportCommentAction,
    banReportUserAction,
} from "@/app/actions/reports";

export type Report = {
    id: string;
    reason: string;
    reasonLabel: string;
    detail: string | null;
    created_at: string;
    target_post_id: string | null;
    target_kind: "post" | "comment";
    reporter_name: string;
    content: string;
    author_name: string;
};

export function ReportRow({ report }: { report: Report }) {
    const router = useRouter();
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const callAction = (action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, confirmMsg: string) => {
        if (!confirm(confirmMsg)) return;
        const fd = new FormData();
        fd.set("report_id", report.id);
        if (note.trim()) fd.set("note", note.trim());
        startTransition(async () => {
            const r = await action(fd);
            if (r.ok) router.refresh();
            else setError(r.error ?? "Erreur");
        });
    };

    const onDismiss = () =>
        callAction(dismissReportAction, "Ignorer ce signalement ?");
    const onHide = () =>
        callAction(
            report.target_kind === "post"
                ? hideReportPostAction
                : hideReportCommentAction,
            `Masquer ce ${report.target_kind === "post" ? "post" : "commentaire"} ? L'auteur sera notifié.`
        );
    const onBan = () =>
        callAction(
            banReportUserAction,
            `BANNIR définitivement l'auteur (${report.author_name}) ? Action très lourde.`
        );

    return (
        <article className="border border-border bg-background">
            <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
          <span className="px-2 py-0.5 text-[10px] uppercase tracking-wide bg-destructive/15 text-destructive">
            {report.reasonLabel}
          </span>
                    <span className="text-xs text-muted-foreground">
            Signalé par {report.reporter_name}
          </span>
                    <span className="text-xs text-muted-foreground">
            {new Date(report.created_at).toLocaleString("fr-BE", {
                dateStyle: "short",
                timeStyle: "short",
            })}
          </span>
                </div>
                {report.target_post_id && (
                    <Link
                        href={`/post/${report.target_post_id}`}
                        target="_blank"
                        className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors"
                    >
                        Voir le post →
                    </Link>
                )}
            </header>

            <div className="px-5 py-4 space-y-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        {report.target_kind === "post"
                            ? "Contenu du post"
                            : "Contenu du commentaire"}{" "}
                        — {report.author_name}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-line line-clamp-6 italic">
                        &laquo; {report.content} &raquo;
                    </p>
                </div>
                {report.detail && (
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                            Précisions du signalement
                        </p>
                        <p className="mt-1 text-sm leading-relaxed">{report.detail}</p>
                    </div>
                )}
            </div>

            <div className="px-5 py-4 border-t border-border space-y-3">
                <label className="block">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Note de modération (optionnelle, visible par l&apos;auteur si masquage)
          </span>
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={1000}
                        placeholder="Ex: contenu insultant, viol de la charte, etc."
                        className="mt-1 w-full bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                </label>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={onDismiss}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide border border-border px-4 py-2 hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                        Ignorer
                    </button>
                    <button
                        type="button"
                        onClick={onHide}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide bg-destructive/10 text-destructive border border-destructive/30 px-4 py-2 hover:bg-destructive/20 transition-colors disabled:opacity-50"
                    >
                        Masquer le {report.target_kind === "post" ? "post" : "commentaire"}
                    </button>
                    <button
                        type="button"
                        onClick={onBan}
                        disabled={isPending}
                        className="text-xs uppercase tracking-wide bg-destructive text-background px-4 py-2 hover:bg-destructive/90 transition-colors disabled:opacity-50 font-medium"
                    >
                        Bannir l&apos;auteur
                    </button>
                </div>
            </div>
        </article>
    );
}