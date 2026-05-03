import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportRow } from "@/components/sente/report-row";

const REASON_LABELS: Record<string, string> = {
    spam: "Spam",
    harassment: "Harcèlement",
    inappropriate: "Contenu inapproprié",
    misinfo: "Informations trompeuses",
    other: "Autre",
};

export default async function AdminReportsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: isAdmin } = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
    if (!isAdmin) redirect("/");

    // Reports en pending
    const { data: pendingReports } = await supabase
        .from("reports")
        .select(
            `id, reason, detail, created_at, status,
         target_type, target_id,
         reporter:profiles!reporter_user_id(id, full_name)`
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(100);

    // Pour chaque, on récupère le contenu de la cible
    const reportsWithTarget = await Promise.all(
        (pendingReports ?? []).map(async (r) => {
            let content: string | null = null;
            let authorName: string | null = null;
            let postIdForLink: string | null = null;

            if (r.target_type === "post") {
                postIdForLink = r.target_id;
                const { data: p } = await supabase
                    .from("posts")
                    .select(
                        "content, author:profiles!author_user_id(id, full_name)"
                    )
                    .eq("id", r.target_id)
                    .maybeSingle();
                if (p) {
                    content = p.content;
                    const a = Array.isArray(p.author) ? p.author[0] : p.author;
                    authorName = a?.full_name ?? null;
                }
            } else if (r.target_type === "comment") {
                const { data: c } = await supabase
                    .from("post_comments")
                    .select(
                        "content, post_id, author:profiles!author_user_id(id, full_name)"
                    )
                    .eq("id", r.target_id)
                    .maybeSingle();
                if (c) {
                    content = c.content;
                    postIdForLink = c.post_id;
                    const a = Array.isArray(c.author) ? c.author[0] : c.author;
                    authorName = a?.full_name ?? null;
                }
            }

            const reporter = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter;

            return {
                id: r.id,
                reason: r.reason,
                reasonLabel: REASON_LABELS[r.reason] ?? r.reason,
                detail: r.detail,
                created_at: r.created_at,
                target_post_id: postIdForLink, // pour le lien "voir le post"
                reporter_name: reporter?.full_name ?? "Anonyme",
                target_kind: r.target_type as "post" | "comment",
                content: content ?? "[Contenu introuvable]",
                author_name: authorName ?? "Inconnu",
            };
        })
    );

    // Stats
    const { count: pendingCount } = await supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
    const { count: resolvedCount } = await supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .neq("status", "pending");

    return (
        <div className="space-y-10">
            <div>
                <Link
                    href="/admin/organizations"
                    className="inline-block text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    ← Backoffice
                </Link>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Modération
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Signalements
                </h1>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md">
                <Stat label="En attente" value={pendingCount ?? 0} />
                <Stat label="Traités" value={resolvedCount ?? 0} />
            </div>

            {reportsWithTarget.length === 0 ? (
                <div className="border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        Aucun signalement en attente.
                    </p>
                </div>
            ) : (
                <ul className="space-y-4">
                    {reportsWithTarget.map((r) => (
                        <li key={r.id}>
                            <ReportRow report={r} />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="border border-border bg-secondary/20 p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
            </p>
            <p className="mt-2 font-display text-3xl tracking-tight tabular-nums">
                {value}
            </p>
        </div>
    );
}