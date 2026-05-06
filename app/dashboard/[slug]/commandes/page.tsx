import { getDashboardContext } from "@/lib/dal/dashboard";
import {
    getOrdersForMagasin,
    getOrderCountsForMagasin,
    type OrderStatusFilter,
    type DeliveryMethod,
} from "@/lib/dal/orders";
import { OrdersList } from "@/components/sente/orders-list";

type SearchParams = Promise<{
    filter?: string;
    delivery?: string;
    search?: string;
}>;

type Params = Promise<{ slug: string }>;

const VALID_FILTERS: OrderStatusFilter[] = [
    "all",
    "to_prepare",
    "in_progress",
    "completed",
    "cancelled_or_refunded",
];

const VALID_DELIVERY: Array<DeliveryMethod | "all"> = [
    "all",
    "click_collect",
    "shipping_standard",
    "shipping_local",
];

export default async function CommandesPage({
                                                params,
                                                searchParams,
                                            }: {
    params: Params;
    searchParams: SearchParams;
}) {
    const { slug } = await params;
    const sp = await searchParams;

    const ctx = await getDashboardContext(slug);

    if (ctx.org.org_type !== "magasin") {
        return (
            <div className="border border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">
                    Cette section est réservée aux magasins.
                </p>
            </div>
        );
    }

    const filter: OrderStatusFilter = VALID_FILTERS.includes(
        sp.filter as OrderStatusFilter
    )
        ? (sp.filter as OrderStatusFilter)
        : "all";

    const delivery: DeliveryMethod | "all" = VALID_DELIVERY.includes(
        sp.delivery as DeliveryMethod | "all"
    )
        ? (sp.delivery as DeliveryMethod | "all")
        : "all";

    const search = typeof sp.search === "string" ? sp.search : "";

    const [orders, counts] = await Promise.all([
        getOrdersForMagasin({
            organization_id: ctx.org.id,
            filter,
            delivery_method: delivery,
            search: search || undefined,
        }),
        getOrderCountsForMagasin(ctx.org.id),
    ]);

    return (
        <div className="space-y-8">
            <header>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Ventes
                </p>
                <h1 className="mt-2 font-display text-3xl tracking-tight">
                    Commandes
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Gère les commandes reçues. Marque-les comme préparées, prêtes ou
                    expédiées au fil de leur avancement.
                </p>
            </header>

            <OrdersList
                slug={slug}
                orders={orders}
                counts={counts}
                currentFilter={filter}
                currentDelivery={delivery}
                currentSearch={search}
            />
        </div>
    );
}