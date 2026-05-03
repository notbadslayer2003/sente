import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDashboardContext } from "@/lib/dal/dashboard";
import { getEventDetail } from "@/lib/dal/events";
import { createClient } from "@/lib/supabase/server";
import { RegistrationsList } from "@/components/sente/registrations-list";

type Params = Promise<{ slug: string; id: string }>;

export default async function EventRegistrationsPage({
                                                         params,
                                                     }: {
    params: Params;
}) {
    const { slug, id } = await params;
    const ctx = await getDashboardContext(slug);
    const event = await getEventDetail(id);
    if (!event || event.organization.id !== ctx.org.id) notFound();

    const supabase = await createClient();
    const { data: registrations } = await supabase
        .from("event_registrations")
        .select(
            `id, full_name, email, phone, payment_method, payment_status,
             paid_amount_cents, refunded_amount_cents, sente_commission_cents,
             stripe_payment_intent_id, notes, paid_at, refunded_at, refund_reason, created_at`
        )
        .eq("event_id", id)
        .order("created_at", { ascending: true });

    const totalPaid = (registrations ?? [])
        .filter((r) => r.payment_method === "online_card" && r.payment_status === "paid")
        .reduce((sum, r) => sum + (r.paid_amount_cents ?? 0), 0);
    const totalCash = (registrations ?? []).filter((r) => r.payment_method === "on_site_cash").length;
    const totalRefunded = (registrations ?? []).reduce(
        (sum, r) => sum + (r.refunded_amount_cents ?? 0),
        0
    );

    return (
        <div className="space-y-10">
            <div>
                <Link
                    href={`/dashboard/${slug}/evenements`}
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-4"
                >
                    <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                    Retour aux événements
                </Link>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Inscrits — {event.title}
                </p>
                <h1 className="mt-3 font-display text-3xl tracking-tight leading-[1.05]">
                    {event.registrations_count} inscrit{event.registrations_count > 1 ? "s" : ""}
                    {event.max_participants && (
                        <span className="text-muted-foreground"> / {event.max_participants}</span>
                    )}
                </h1>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Stat label="Encaissé en ligne" value={`${(totalPaid / 100).toFixed(0)} €`} />
                <Stat label="Espèces sur place" value={`${totalCash} inscriptions`} />
                <Stat label="Remboursé" value={`${(totalRefunded / 100).toFixed(0)} €`} />
            </div>

            <RegistrationsList
                eventId={id}
                eventTitle={event.title}
                eventStatus={event.status}
                registrations={registrations ?? []}
                dashboardSlug={slug}
            />
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-border bg-secondary/20 p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {label}
            </p>
            <p className="mt-2 font-display text-2xl tracking-tight tabular-nums">{value}</p>
        </div>
    );
}