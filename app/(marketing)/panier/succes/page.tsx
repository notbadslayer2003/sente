import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {ReloadButton} from "@/components/sente/reload-button";

type SearchParams = Promise<{ order_id?: string }>;

export default async function PanierSuccesPage({
                                                   searchParams,
                                               }: {
    searchParams: SearchParams;
}) {
    const sp = await searchParams;
    if (!sp.order_id) redirect("/panier");

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/panier");

    // Récupère la commande pour afficher les infos
    const { data: order } = await supabase
        .from("orders")
        .select(
            `id, status, total_cents, paid_at, delivery_method,
             magasin:organizations!magasin_id(slug, name)`
        )
        .eq("id", sp.order_id)
        .eq("buyer_user_id", user.id)
        .maybeSingle();

    if (!order) {
        return (
            <section className="bg-background min-h-screen pt-24 pb-16">
                <div className="mx-auto max-w-2xl px-6 sm:px-8 text-center">
                    <h1 className="font-display-soft text-4xl tracking-tight">
                        Commande introuvable.
                    </h1>
                    <p className="mt-4 text-sm text-muted-foreground">
                        Si tu viens de payer, attends quelques secondes et recharge.
                    </p>
                    <Link
                        href="/panier"
                        className="mt-6 inline-block px-5 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                    >
                        Retour au panier
                    </Link>
                </div>
            </section>
        );
    }

    const magasin = Array.isArray(order.magasin) ? order.magasin[0] : order.magasin;
    const isPending = order.status === "pending_payment";
    const isPaid = ["paid", "preparing", "ready_for_pickup", "shipped"].includes(
        order.status as string
    );

    return (
        <section className="bg-background min-h-screen pt-24 pb-16">
            <div className="mx-auto max-w-2xl px-6 sm:px-8">
                {isPaid ? (
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-primary">
                                Paiement reçu
                            </p>
                            <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                                Commande confirmée.
                            </h1>
                        </div>

                        <div className="border border-border p-6 space-y-4">
                            <Row label="Numéro de commande" value={`#${order.id.slice(0, 8).toUpperCase()}`} />
                            <Row
                                label="Magasin"
                                value={
                                    magasin ? (
                                        <Link
                                            href={`/magasins/${magasin.slug}`}
                                            className="hover:text-accent transition-colors"
                                        >
                                            {magasin.name}
                                        </Link>
                                    ) : (
                                        "—"
                                    )
                                }
                            />
                            <Row
                                label="Total"
                                value={`${(order.total_cents / 100).toFixed(2)} €`}
                            />
                            <Row
                                label="Mode de récupération"
                                value={
                                    order.delivery_method === "click_collect"
                                        ? "Retrait en magasin"
                                        : order.delivery_method === "shipping_standard"
                                            ? "Livraison standard"
                                            : order.delivery_method === "shipping_local"
                                                ? "Livraison locale"
                                                : "—"
                                }
                            />
                        </div>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Tu vas recevoir un email de confirmation. Le magasin va préparer
                            ta commande et te tenir au courant.
                        </p>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/profil/commandes"
                                className="px-5 py-2.5 text-xs uppercase tracking-wide bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                            >
                                Mes commandes
                            </Link>
                            {magasin && (
                                <Link
                                    href={`/magasins/${magasin.slug}/boutique`}
                                    className="px-5 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                                >
                                    Continuer mes achats
                                </Link>
                            )}
                        </div>
                    </div>
                ) : isPending ? (
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                Finalisation
                            </p>
                            <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                                On finalise ta commande...
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Ton paiement est en cours de traitement. Cela prend généralement
                            quelques secondes. Tu peux recharger cette page.
                        </p>
                        <ReloadButton />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-destructive">
                                Statut inattendu
                            </p>
                            <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                                Commande {order.status}.
                            </h1>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Si tu penses qu'il y a une erreur, contacte le support.
                        </p>
                        <Link
                            href="/profil/commandes"
                            className="inline-block px-5 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                        >
                            Mes commandes
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}

function Row({
                 label,
                 value,
             }: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex justify-between items-baseline gap-4">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {label}
            </span>
            <span className="text-sm font-medium text-right">{value}</span>
        </div>
    );
}