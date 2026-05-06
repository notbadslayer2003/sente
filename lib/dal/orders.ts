import { createClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

export type OrderStatus =
    | "pending_payment"
    | "paid"
    | "preparing"
    | "ready_for_pickup"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded"
    | "disputed";

export type DeliveryMethod =
    | "click_collect"
    | "shipping_standard"
    | "shipping_local";

export type OrderListItem = {
    id: string;
    status: OrderStatus;
    delivery_method: DeliveryMethod | null;
    total_cents: number;
    items_count: number;
    customer_name: string | null;
    customer_email: string | null;
    paid_at: string | null;
    created_at: string;
};

export type OrderItemDetail = {
    id: string;
    product_id: string;
    variant_id: string | null;
    product_name: string;
    variant_name: string | null;
    variant_options: Record<string, string>;
    sku: string | null;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
    refunded_quantity: number;
    refunded_amount_cents: number;
    refund_reason: string | null;
};

export type ShippingAddress = {
    name?: string | null;
    address?: {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        postal_code?: string | null;
        country?: string | null;
        state?: string | null;
    } | null;
} | null;

export type OrderDetail = {
    id: string;
    magasin_id: string;
    buyer_user_id: string;
    status: OrderStatus;
    delivery_method: DeliveryMethod | null;
    subtotal_cents: number;
    shipping_cents: number;
    total_cents: number;
    sente_commission_cents: number;
    commission_rate_bps: number;
    refunded_amount_cents: number;
    customer_email: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    shipping_address: ShippingAddress;
    tracking_carrier: string | null;
    tracking_number: string | null;
    refund_reason: string | null;
    paid_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    cancelled_at: string | null;
    refunded_at: string | null;
    created_at: string;
    updated_at: string;
    items: OrderItemDetail[];
    magasin: {
        id: string;
        slug: string;
        name: string;
    };
};

export type OrderStatusFilter =
    | "all"
    | "to_prepare"
    | "in_progress"
    | "completed"
    | "cancelled_or_refunded";

// =============================================================================
// Lectures côté magasin
// =============================================================================

/**
 * Compte les commandes par catégorie de filtre pour les badges des onglets.
 */
export async function getOrderCountsForMagasin(
    organizationId: string
): Promise<Record<OrderStatusFilter, number>> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("magasin_id", organizationId)
        .neq("status", "pending_payment"); // on ignore les paniers Stripe non finalisés

    const counts: Record<OrderStatusFilter, number> = {
        all: 0,
        to_prepare: 0,
        in_progress: 0,
        completed: 0,
        cancelled_or_refunded: 0,
    };

    for (const row of data ?? []) {
        const status = row.status as OrderStatus;
        // "Toutes" = tout sauf annulé/refundé/disputé
        if (!["cancelled", "refunded", "disputed"].includes(status)) {
            counts.all++;
        }
        if (status === "paid") counts.to_prepare++;
        if (["preparing", "ready_for_pickup", "shipped"].includes(status)) {
            counts.in_progress++;
        }
        if (status === "delivered") counts.completed++;
        if (["cancelled", "refunded", "disputed"].includes(status)) {
            counts.cancelled_or_refunded++;
        }
    }

    return counts;
}

/**
 * Liste les commandes d'un magasin, filtrées par catégorie.
 * Utilise la RLS — vérifie que l'user est membre de l'org.
 */
export async function getOrdersForMagasin(opts: {
    organization_id: string;
    filter?: OrderStatusFilter;
    delivery_method?: DeliveryMethod | "all";
    search?: string;
    limit?: number;
}): Promise<OrderListItem[]> {
    const limit = opts.limit ?? 50;
    const supabase = await createClient();

    let q = supabase
        .from("orders")
        .select(
            `id, status, delivery_method, total_cents, customer_name, customer_email,
             paid_at, created_at,
             items:order_items!order_id(id)`
        )
        .eq("magasin_id", opts.organization_id)
        .neq("status", "pending_payment")
        .order("created_at", { ascending: false })
        .limit(limit);

    // Filtre par catégorie
    const filter = opts.filter ?? "all";
    if (filter === "all") {
        q = q.not("status", "in", "(cancelled,refunded,disputed)");
    } else if (filter === "to_prepare") {
        q = q.eq("status", "paid");
    } else if (filter === "in_progress") {
        q = q.in("status", ["preparing", "ready_for_pickup", "shipped"]);
    } else if (filter === "completed") {
        q = q.eq("status", "delivered");
    } else if (filter === "cancelled_or_refunded") {
        q = q.in("status", ["cancelled", "refunded", "disputed"]);
    }

    // Filtre par mode de récup
    if (opts.delivery_method && opts.delivery_method !== "all") {
        q = q.eq("delivery_method", opts.delivery_method);
    }

    // Search : nom client, email, ou début d'id
    if (opts.search && opts.search.trim().length > 0) {
        const s = opts.search.trim();
        // Si le search ressemble à un début d'UUID (hex), on filtre sur id
        const isHex = /^[0-9a-fA-F]{1,8}$/.test(s);
        if (isHex) {
            q = q.ilike("id", `${s.toLowerCase()}%`);
        } else {
            // Sinon search sur customer_name OR customer_email
            q = q.or(
                `customer_name.ilike.%${s}%,customer_email.ilike.%${s}%`
            );
        }
    }

    const { data, error } = await q;
    if (error || !data) {
        if (error) console.error("getOrdersForMagasin failed:", error);
        return [];
    }

    return data.map((row) => ({
        id: row.id,
        status: row.status as OrderStatus,
        delivery_method: row.delivery_method as DeliveryMethod | null,
        total_cents: row.total_cents,
        items_count: Array.isArray(row.items) ? row.items.length : 0,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        paid_at: row.paid_at,
        created_at: row.created_at,
    }));
}

/**
 * Détail complet d'une commande pour le dashboard magasin.
 * RLS : seulement si l'user est membre du magasin OU buyer.
 */
export async function getOrderForMagasin(
    orderId: string
): Promise<OrderDetail | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("orders")
        .select(
            `id, magasin_id, buyer_user_id, status, delivery_method,
             subtotal_cents, shipping_cents, total_cents,
             sente_commission_cents, commission_rate_bps, refunded_amount_cents,
             customer_email, customer_name, customer_phone, shipping_address,
             tracking_carrier, tracking_number, refund_reason,
             paid_at, shipped_at, delivered_at, cancelled_at, refunded_at,
             created_at, updated_at,
             magasin:organizations!magasin_id(id, slug, name),
             items:order_items!order_id(
                id, product_id, variant_id, product_name, variant_name,
                variant_options, sku, unit_price_cents, quantity, line_total_cents,
                refunded_quantity, refunded_amount_cents, refund_reason
             )`
        )
        .eq("id", orderId)
        .maybeSingle();

    if (error || !data) {
        if (error) console.error("getOrderForMagasin failed:", error);
        return null;
    }

    const magasin = Array.isArray(data.magasin) ? data.magasin[0] : data.magasin;
    if (!magasin) return null;

    const items = ((data.items ?? []) as OrderItemDetail[]).sort(
        (a, b) => a.product_name.localeCompare(b.product_name)
    );

    return {
        id: data.id,
        magasin_id: data.magasin_id,
        buyer_user_id: data.buyer_user_id,
        status: data.status as OrderStatus,
        delivery_method: data.delivery_method as DeliveryMethod | null,
        subtotal_cents: data.subtotal_cents,
        shipping_cents: data.shipping_cents,
        total_cents: data.total_cents,
        sente_commission_cents: data.sente_commission_cents,
        commission_rate_bps: data.commission_rate_bps,
        refunded_amount_cents: data.refunded_amount_cents,
        customer_email: data.customer_email,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        shipping_address: data.shipping_address as ShippingAddress,
        tracking_carrier: data.tracking_carrier,
        tracking_number: data.tracking_number,
        refund_reason: data.refund_reason,
        paid_at: data.paid_at,
        shipped_at: data.shipped_at,
        delivered_at: data.delivered_at,
        cancelled_at: data.cancelled_at,
        refunded_at: data.refunded_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items,
        magasin: {
            id: magasin.id,
            slug: magasin.slug,
            name: magasin.name,
        },
    };
}

// =============================================================================
// Lectures côté acheteur
// =============================================================================

export type OrderRefundEvent = {
    id: string;
    kind: "item" | "shipping";
    amount_cents: number;
    reason: string | null;
    item_name: string | null;
    item_quantity: number | null;
    created_at: string;
};

/**
 * Détail d'une commande côté acheteur.
 * Sécurité : on filtre explicitement par buyer_user_id pour bloquer l'accès
 * aux commandes d'autres users (defense in depth en plus de la RLS).
 */
export async function getOrderForBuyer(
    orderId: string,
    userId: string
): Promise<OrderDetail | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("orders")
        .select(
            `id, magasin_id, buyer_user_id, status, delivery_method,
             subtotal_cents, shipping_cents, total_cents,
             sente_commission_cents, commission_rate_bps, refunded_amount_cents,
             customer_email, customer_name, customer_phone, shipping_address,
             tracking_carrier, tracking_number, refund_reason,
             paid_at, shipped_at, delivered_at, cancelled_at, refunded_at,
             created_at, updated_at,
             magasin:organizations!magasin_id(id, slug, name),
             items:order_items!order_id(
                id, product_id, variant_id, product_name, variant_name,
                variant_options, sku, unit_price_cents, quantity, line_total_cents,
                refunded_quantity, refunded_amount_cents, refund_reason
             )`
        )
        .eq("id", orderId)
        .eq("buyer_user_id", userId)
        .maybeSingle();

    if (error || !data) {
        if (error) console.error("getOrderForBuyer failed:", error);
        return null;
    }

    const magasin = Array.isArray(data.magasin) ? data.magasin[0] : data.magasin;
    if (!magasin) return null;

    const items = ((data.items ?? []) as OrderItemDetail[]).sort(
        (a, b) => a.product_name.localeCompare(b.product_name)
    );

    return {
        id: data.id,
        magasin_id: data.magasin_id,
        buyer_user_id: data.buyer_user_id,
        status: data.status as OrderStatus,
        delivery_method: data.delivery_method as DeliveryMethod | null,
        subtotal_cents: data.subtotal_cents,
        shipping_cents: data.shipping_cents,
        total_cents: data.total_cents,
        sente_commission_cents: data.sente_commission_cents,
        commission_rate_bps: data.commission_rate_bps,
        refunded_amount_cents: data.refunded_amount_cents,
        customer_email: data.customer_email,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        shipping_address: data.shipping_address as ShippingAddress,
        tracking_carrier: data.tracking_carrier,
        tracking_number: data.tracking_number,
        refund_reason: data.refund_reason,
        paid_at: data.paid_at,
        shipped_at: data.shipped_at,
        delivered_at: data.delivered_at,
        cancelled_at: data.cancelled_at,
        refunded_at: data.refunded_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
        items,
        magasin: {
            id: magasin.id,
            slug: magasin.slug,
            name: magasin.name,
        },
    };
}

/**
 * Historique des remboursements d'une commande.
 * On lit la table payments où kind='refund' et raw_event contient les métadonnées.
 */
export async function getOrderRefundsHistory(
    orderId: string
): Promise<OrderRefundEvent[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("payments")
        .select("id, amount_cents, raw_event, created_at")
        .eq("kind", "refund")
        .eq("reference_id", orderId)
        .order("created_at", { ascending: true });

    if (error || !data) {
        if (error) console.error("getOrderRefundsHistory failed:", error);
        return [];
    }

    return data.map((row) => {
        const raw = (row.raw_event ?? {}) as Record<string, unknown>;
        const isShipping = raw.sente_refund_target === "shipping";
        return {
            id: row.id,
            kind: (isShipping ? "shipping" : "item") as "shipping" | "item",
            amount_cents: row.amount_cents,
            reason: typeof raw.sente_refund_reason === "string" ? raw.sente_refund_reason : null,
            item_name: typeof raw.sente_refund_item_name === "string" ? raw.sente_refund_item_name : null,
            item_quantity: typeof raw.sente_refund_quantity === "number" ? raw.sente_refund_quantity : null,
            created_at: row.created_at,
        };
    });
}