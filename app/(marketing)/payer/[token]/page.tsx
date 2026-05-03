import Link from "next/link";
import { hashToken } from "@/lib/utils/token";
import { createAdminClient } from "@/lib/supabase/admin";
import { PayClient } from "@/components/sente/pay-client";

type Params = Promise<{ token: string }>;

export default async function PayerPage({ params }: { params: Params }) {
    const { token } = await params;

    if (!token || token.length !== 64) {
        return <PayError message="Lien de paiement invalide." />;
    }

    // Lookup via service_role (anon n'a pas accès à pecheur_subscriptions)
    const admin = createAdminClient();
    const tokenHash = hashToken(token);

    const { data: sub } = await admin
        .from("pecheur_subscriptions")
        .select(
            `id, etang_id, pecheur_full_name, pecheur_email, saison_year,
         start_date, end_date, price_cents, paid_amount_cents, payment_status,
         payment_token_expires_at, payment_token_used_at,
         organization:organizations!etang_id(slug, name, stripe_account_id, stripe_charges_enabled)`
        )
        .eq("payment_token_hash", tokenHash)
        .maybeSingle();

    if (!sub) {
        return <PayError message="Lien introuvable ou invalide." />;
    }

    if (sub.payment_token_used_at) {
        return <PayError message="Ce lien a déjà été utilisé." />;
    }

    if (
        sub.payment_token_expires_at &&
        new Date(sub.payment_token_expires_at) < new Date()
    ) {
        return <PayError message="Ce lien a expiré. Demande un nouveau lien à l'étang." />;
    }

    if (sub.payment_status === "paid") {
        return <PayError message="Cet abonnement a déjà été payé." />;
    }

    const org = Array.isArray(sub.organization)
        ? sub.organization[0]
        : sub.organization;

    if (!org?.stripe_charges_enabled) {
        return <PayError message="Le paiement n'est pas disponible pour cet étang." />;
    }

    // 2e query : récupère la commission rate via etang_details
    const { data: etang } = await admin
        .from("etang_details")
        .select("commission_rate_bps")
        .eq("organization_id", sub.etang_id)
        .maybeSingle();


    const remainingCents = sub.price_cents - sub.paid_amount_cents;
    const commissionBps = etang?.commission_rate_bps ?? 300;

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-md px-6 sm:px-8">
                <div className="text-center">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Paiement Sente
                    </p>
                    <h1 className="mt-3 font-display-soft text-4xl tracking-tight leading-[0.95]">
                        Régler {org.name}
                    </h1>
                </div>

                <div className="mt-10 border border-border bg-secondary/20 p-6">
                    <dl className="space-y-3 text-sm">
                        <Row label="Pêcheur" value={sub.pecheur_full_name} />
                        <Row label="Saison" value={sub.saison_year.toString()} />
                        <Row
                            label="Période"
                            value={`${formatDate(sub.start_date)} → ${formatDate(sub.end_date)}`}
                        />
                        {sub.paid_amount_cents > 0 && (
                            <Row
                                label="Déjà versé"
                                value={`${(sub.paid_amount_cents / 100).toFixed(2)} €`}
                            />
                        )}
                    </dl>
                </div>

                <div className="mt-6 border border-primary/30 bg-primary/5 p-6">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Montant à régler
                    </p>
                    <p className="mt-2 font-display text-5xl tracking-tight">
                        {(remainingCents / 100).toFixed(2)} €
                    </p>
                </div>

                <div className="mt-8">
                    <PayClient
                        token={token}
                        amountCents={remainingCents}
                        commissionBps={commissionBps}
                    />
                </div>

                <p className="mt-8 text-xs text-muted-foreground text-center leading-relaxed">
                    Paiement sécurisé par Stripe. L'argent est versé directement à
                    l'étang, Sente prélève {(commissionBps / 100).toFixed(2)}% de
                    commission.
                </p>
            </div>
        </section>
    );
}

function PayError({ message }: { message: string }) {
    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-md px-6 text-center space-y-6">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Paiement
                </p>
                <h1 className="font-display-soft text-4xl tracking-tight leading-[0.95]">
                    Lien indisponible.
                </h1>
                <p className="text-sm text-muted-foreground">{message}</p>
                <Link
                    href="/"
                    className="inline-block text-sm uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                >
                    ← Retour à l'accueil
                </Link>
            </div>
        </section>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-foreground">{value}</dd>
        </div>
    );
}

function formatDate(d: string): string {
    return new Date(d).toLocaleDateString("fr-BE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}