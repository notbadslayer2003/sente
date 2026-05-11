import Link from "next/link";
import {redirect} from "next/navigation";
import Image from "next/image";
import {createClient} from "@/lib/supabase/server";
import {formatPriceEur} from "@/lib/utils/format";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    pending_payment: {
        label: "Paiement en cours",
        className: "bg-muted text-muted-foreground",
    },
    paid: {label: "Payée", className: "bg-primary/15 text-primary"},
    preparing: {
        label: "En préparation",
        className: "bg-accent/15 text-accent",
    },
    ready_for_pickup: {
        label: "Prête à retirer",
        className: "bg-accent/15 text-accent",
    },
    shipped: {label: "Expédiée", className: "bg-accent/15 text-accent"},
    delivered: {label: "Livrée", className: "bg-primary/15 text-primary"},
    cancelled: {
        label: "Annulée",
        className: "bg-destructive/15 text-destructive",
    },
    refunded: {
        label: "Remboursée",
        className: "bg-destructive/15 text-destructive",
    },
    disputed: {
        label: "Litige",
        className: "bg-destructive/15 text-destructive",
    },
};

const DELIVERY_LABELS: Record<string, string> = {
    click_collect: "Retrait en magasin",
    shipping_standard: "Livraison standard",
    shipping_local: "Livraison locale",
};

export default async function MesCommandesPage() {
    const supabase = await createClient();
    const {
        data: {user},
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/profil/commandes");

    const {data: orders} = await supabase
        .from("orders")
        .select(
            `id, status, total_cents, delivery_method, paid_at, created_at,
             magasin:organizations!magasin_id(slug, name, cover_image_url),
             items:order_items!order_id(product_name, variant_name, quantity)`
        )
        .eq("buyer_user_id", user.id)
        .order("created_at", {ascending: false});

    return (
        <section className="bg-background min-h-screen pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                <header className="mb-10">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Mes achats
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                        Commandes.
                    </h1>
                </header>

                {!orders || orders.length === 0 ? (
                    <div className="border border-dashed border-border p-16 text-center">
                        <p className="text-base">Tu n'as pas encore de commande.</p>
                        <Link
                            href="/magasins"
                            className="mt-6 inline-block px-5 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent transition-colors"
                        >
                            Découvrir les magasins →
                        </Link>
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {orders.map((order) => {
                            const magasin = Array.isArray(order.magasin)
                                ? order.magasin[0]
                                : order.magasin;
                            const items = (order.items ?? []) as Array<{
                                product_name: string;
                                variant_name: string | null;
                                quantity: number;
                            }>;
                            const statusInfo =
                                STATUS_LABELS[order.status as string] ??
                                STATUS_LABELS.pending_payment;
                            const orderShort = (order.id as string)
                                .slice(0, 8)
                                .toUpperCase();

                            return (
                                <li
                                    key={order.id as string}
                                    className="hover:bg-secondary/20 transition-colors"
                                >
                                    <Link
                                        href={`/profil/commandes/${order.id}`}
                                        className="block border border-border p-5 hover:bg-secondary/20 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-4 flex-wrap">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className="w-12 h-12 bg-secondary border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {magasin?.cover_image_url ? (
                                                        <Image
                                                            src={magasin.cover_image_url}
                                                            alt={magasin.name}
                                                            width={48}
                                                            height={48}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <span
                                                            className="text-[8px] uppercase tracking-wide text-muted-foreground">
                                                        {magasin?.name?.slice(0, 2) ??
                                                            "??"}
                                                    </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    {magasin ? (
                                                        <Link
                                                            href={`/magasins/${magasin.slug}`}
                                                            className="text-sm font-medium hover:text-accent transition-colors truncate block"
                                                        >
                                                            {magasin.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">
                                                        Magasin supprimé
                                                    </span>
                                                    )}
                                                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono mt-0.5">
                                                        #{orderShort}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                            <span
                                                className={`px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusInfo.className}`}
                                            >
                                                {statusInfo.label}
                                            </span>
                                                <span className="font-display text-lg">
                                                {formatPriceEur(
                                                    order.total_cents as number,
                                                    {showFree: false}
                                                )}
                                            </span>
                                            </div>
                                        </div>

                                        <div className="mt-3 text-xs text-muted-foreground">
                                            {items.length} article
                                            {items.length > 1 ? "s" : ""} ·{" "}
                                            {DELIVERY_LABELS[
                                                order.delivery_method as string
                                                ] ?? "—"}
                                            {order.paid_at && (
                                                <>
                                                    {" · "}
                                                    {new Date(
                                                        order.paid_at as string
                                                    ).toLocaleDateString("fr-BE", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                    })}
                                                </>
                                            )}
                                        </div>

                                        {items.length > 0 && (
                                            <ul className="mt-3 text-xs text-muted-foreground space-y-0.5">
                                                {items.slice(0, 3).map((it, idx) => (
                                                    <li key={idx}>
                                                        • {it.product_name}
                                                        {it.variant_name &&
                                                            ` (${it.variant_name})`}{" "}
                                                        × {it.quantity}
                                                    </li>
                                                ))}
                                                {items.length > 3 && (
                                                    <li className="italic">
                                                        + {items.length - 3} autre
                                                        {items.length - 3 > 1 ? "s" : ""}
                                                    </li>
                                                )}
                                            </ul>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}