import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function MyInscriptionsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/profil/inscriptions");

    const { data: registrations } = await supabase
        .from("event_registrations")
        .select(
            `id, full_name, payment_method, payment_status,
             paid_amount_cents, refunded_amount_cents, refund_reason, created_at,
             event:events!event_id(
                id, title, starts_at, location_text, cover_image_url, status,
                organization:organizations!organization_id(name, slug, org_type)
             )`
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    type Reg = (typeof registrations)[number];
    const items = (registrations ?? []).map((r: Reg) => {
        const event = Array.isArray(r.event) ? r.event[0] : r.event;
        const org = event && (Array.isArray(event.organization) ? event.organization[0] : event.organization);
        if (!event || !org) return null;
        return {
            id: r.id,
            event_id: event.id,
            event_title: event.title,
            event_starts_at: event.starts_at,
            event_location: event.location_text,
            event_cover: event.cover_image_url,
            event_status: event.status,
            org_name: org.name,
            org_slug: org.slug,
            org_type: org.org_type,
            payment_method: r.payment_method,
            payment_status: r.payment_status,
            paid_amount_cents: r.paid_amount_cents,
            refunded_amount_cents: r.refunded_amount_cents,
            refund_reason: r.refund_reason,
            created_at: r.created_at,
        };
    }).filter((i): i is NonNullable<typeof i> => i !== null);

    const upcoming = items.filter((i) => new Date(i.event_starts_at) >= new Date());
    const past = items.filter((i) => new Date(i.event_starts_at) < new Date());

    return (
        <section className="bg-background min-h-screen pt-24 pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8">
                <div className="mb-10">
                    <Link
                        href="/profil"
                        className="inline-block text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                        ← Profil
                    </Link>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Mes inscriptions
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                        Tes événements.
                    </h1>
                </div>

                <Section title="À venir" emptyText="Aucun événement à venir." items={upcoming} />
                <Section title="Passés" emptyText="Aucun événement passé." items={past} />
            </div>
        </section>
    );
}

function Section({
                     title,
                     emptyText,
                     items,
                 }: {
    title: string;
    emptyText: string;
    items: Array<{
        id: string;
        event_id: string;
        event_title: string;
        event_starts_at: string;
        event_location: string | null;
        event_cover: string | null;
        event_status: string;
        org_name: string;
        org_slug: string;
        org_type: string;
        payment_method: string;
        payment_status: string;
        paid_amount_cents: number;
        refunded_amount_cents: number;
        refund_reason: string | null;
    }>;
}) {
    return (
        <div className="mb-12">
            <h2 className="font-display text-xl tracking-tight mb-4">{title}</h2>
            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{emptyText}</p>
            ) : (
                <ul className="space-y-3">
                    {items.map((i) => (
                        <li key={i.id}>
                            <Link
                                href={`/evenements/${i.event_id}`}
                                className="flex items-stretch gap-4 border border-border bg-secondary/10 hover:bg-secondary/30 transition-colors"
                            >
                                <div className="w-24 h-24 sm:w-32 sm:h-32 relative bg-background border-r border-border overflow-hidden shrink-0">
                                    {i.event_cover ? (
                                        <Image
                                            src={i.event_cover}
                                            alt={i.event_title}
                                            fill
                                            sizes="128px"
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : null}
                                </div>
                                <div className="flex-1 p-4 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        {i.event_status === "cancelled" && (
                                            <span className="px-2 py-0.5 text-[9px] uppercase tracking-wide bg-destructive text-background">
                        Annulé
                      </span>
                                        )}
                                        <PaymentBadge
                                            method={i.payment_method}
                                            status={i.payment_status}
                                        />
                                    </div>
                                    <h3 className="font-display text-base leading-tight truncate">
                                        {i.event_title}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">{i.org_name}</p>
                                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 shrink-0" strokeWidth={2} />
                                            <span>{formatDate(i.event_starts_at)}</span>
                                        </div>
                                        {i.event_location && (
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3 h-3 shrink-0" strokeWidth={2} />
                                                <span className="truncate">{i.event_location}</span>
                                            </div>
                                        )}
                                    </div>
                                    {i.refund_reason && (
                                        <p className="mt-2 text-xs text-destructive italic line-clamp-1">
                                            Remboursé : {i.refund_reason}
                                        </p>
                                    )}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function PaymentBadge({ method, status }: { method: string; status: string }) {
    if (method === "free") {
        return (
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-wide bg-primary/15 text-primary">
        Gratuit
      </span>
        );
    }
    if (status === "paid") {
        return (
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-wide bg-primary/15 text-primary">
        Payé
      </span>
        );
    }
    if (status === "refunded") {
        return (
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-wide bg-destructive/15 text-destructive">
        Remboursé
      </span>
        );
    }
    if (method === "on_site_cash") {
        return (
            <span className="px-2 py-0.5 text-[9px] uppercase tracking-wide bg-accent/15 text-accent">
        Espèces sur place
      </span>
        );
    }
    return (
        <span className="px-2 py-0.5 text-[9px] uppercase tracking-wide bg-muted text-muted-foreground">
      En attente
    </span>
    );
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleString("fr-BE", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}