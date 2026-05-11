import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/marketplace/pricing";

// =============================================================================
// Page : /profil/marketplace/commandes
// =============================================================================
// Liste des commandes marketplace de l'user (achats + ventes mélangés).
// Filtres simples via searchParams : ?type=achats|ventes|tous (default: tous)
// =============================================================================

type FilterType = "tous" | "achats" | "ventes";

type StatusTone = "info" | "success" | "neutral" | "danger";

const STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
    pending_payment: { label: "Paiement en cours", tone: "info" },
    paid_awaiting_shipment: { label: "En attente d'envoi", tone: "info" },
    shipped: { label: "Expédiée", tone: "info" },
    delivered: { label: "Livrée", tone: "success" },
    released: { label: "Clôturée", tone: "success" },
    closed: { label: "Clôturée", tone: "neutral" },
    cancelled: { label: "Annulée", tone: "neutral" },
    disputed: { label: "Litige", tone: "danger" },
    refunded: { label: "Remboursée", tone: "neutral" },
};

const TONE_BADGE_CLS: Record<StatusTone, string> = {
    info: "bg-accent/15 text-accent",
    success: "bg-primary/15 text-primary",
    neutral: "bg-secondary/40 text-muted-foreground",
    danger: "bg-destructive/15 text-destructive",
};

type SearchParams = Promise<{ type?: string }>;

export default async function MesCommandesPage({
                                                   searchParams,
                                               }: {
    searchParams: SearchParams;
}) {
    const params = await searchParams;
    const type: FilterType =
        params.type === "achats" || params.type === "ventes" ? params.type : "tous";

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/profil/marketplace/commandes");

    let query = supabase
        .from("marketplace_orders")
        .select(
            `id, status, item_price_cents, total_cents, seller_payout_cents, created_at,
             buyer_user_id, seller_user_id,
             listing:marketplace_listings!listing_id(id, title)`
        )
        .order("created_at", { ascending: false })
        .limit(100);

    if (type === "achats") {
        query = query.eq("buyer_user_id", user.id);
    } else if (type === "ventes") {
        query = query.eq("seller_user_id", user.id);
    } else {
        query = query.or(
            `buyer_user_id.eq.${user.id},seller_user_id.eq.${user.id}`
        );
    }

    const { data: orders } = await query;
    const list = orders ?? [];

    const buyerCount = list.filter((o) => o.buyer_user_id === user.id).length;
    const sellerCount = list.filter((o) => o.seller_user_id === user.id).length;

    return (
        <div className="space-y-10 max-w-4xl">
            {/* Header */}
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Marketplace
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Mes commandes
                </h1>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Retrouve ici tes achats et tes ventes sur le marketplace Sente.
                </p>
            </div>

            {/* Filtres */}
            <div className="flex flex-wrap items-center gap-6 border-b border-border pb-4">
                <FilterLink
                    href="/profil/marketplace/commandes"
                    active={type === "tous"}
                    label="Tout"
                    count={null}
                />
                <FilterLink
                    href="/profil/marketplace/commandes?type=achats"
                    active={type === "achats"}
                    label="Achats"
                    count={type === "tous" ? buyerCount : null}
                />
                <FilterLink
                    href="/profil/marketplace/commandes?type=ventes"
                    active={type === "ventes"}
                    label="Ventes"
                    count={type === "tous" ? sellerCount : null}
                />
            </div>

            {/* Liste ou empty state */}
            {list.length === 0 ? (
                <EmptyState type={type} />
            ) : (
                <ul className="border-y border-border divide-y divide-border">
                    {list.map((order) => {
                        const isBuyer = order.buyer_user_id === user.id;
                        const role: "achat" | "vente" = isBuyer ? "achat" : "vente";
                        const statusInfo =
                            STATUS_LABELS[order.status] ?? {
                                label: order.status,
                                tone: "neutral" as StatusTone,
                            };
                        const amountCents = isBuyer
                            ? order.total_cents
                            : order.seller_payout_cents;

                        // Le listing peut être un array ou un objet selon Supabase
                        const listing = Array.isArray(order.listing)
                            ? order.listing[0]
                            : order.listing;

                        return (
                            <li key={order.id}>
                                <Link
                                    href={`/profil/marketplace/commandes/${order.id}`}
                                    className="block py-5 px-1 hover:bg-secondary/30 transition-colors -mx-1 px-3"
                                >
                                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                                    {role}
                                                </span>
                                                <span
                                                    className={`text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 ${TONE_BADGE_CLS[statusInfo.tone]}`}
                                                >
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            <p className="mt-2 font-display text-lg tracking-tight truncate">
                                                {listing?.title ?? "Annonce supprimée"}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                #{order.id.slice(0, 8).toUpperCase()} ·{" "}
                                                {new Date(order.created_at).toLocaleDateString(
                                                    "fr-BE",
                                                    {
                                                        day: "numeric",
                                                        month: "long",
                                                        year: "numeric",
                                                    }
                                                )}
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="font-display text-xl tracking-tight">
                                                {formatCents(amountCents)}
                                            </p>
                                            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                                {isBuyer ? "Total payé" : "Net vendeur"}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function FilterLink({
                        href,
                        active,
                        label,
                        count,
                    }: {
    href: string;
    active: boolean;
    label: string;
    count: number | null;
}) {
    return (
        <Link
            href={href}
            className={`text-xs uppercase tracking-wide pb-2 transition-colors ${
                active
                    ? "text-foreground border-b-2 border-foreground"
                    : "text-muted-foreground hover:text-foreground"
            }`}
        >
            {label}
            {count !== null && (
                <span className="ml-2 text-muted-foreground/70">({count})</span>
            )}
        </Link>
    );
}

function EmptyState({ type }: { type: FilterType }) {
    const message =
        type === "achats"
            ? "Tu n'as pas encore acheté sur le marketplace."
            : type === "ventes"
                ? "Tu n'as pas encore vendu sur le marketplace."
                : "Tu n'as encore aucune commande sur le marketplace.";

    return (
        <div className="border border-dashed border-border px-6 py-16 text-center space-y-5">
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex justify-center gap-6">
                <Link
                    href="/marketplace"
                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                >
                    Explorer les annonces
                </Link>
                <Link
                    href="/profil/marketplace/annonces/nouvelle"
                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                >
                    Vendre du matériel
                </Link>
            </div>
        </div>
    );
}