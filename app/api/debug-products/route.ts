import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();
    const orgId = "5ea23cf9-1ddc-4eb9-9880-d237cae6190a"; // remplace

    const { data, error } = await supabase
        .from("products")
        .select(
            `id, organization_id, slug, name, short_desc, brand, kind, status,
             photos, tags, published_at, created_at, updated_at,
             category:product_categories!category_id(
                id, slug, name,
                parent:product_categories!parent_id(name)
             ),
             variants:product_variants!product_id(
                id, sku, price_cents, compare_at_price_cents, stock_quantity,
                options, display_order, is_active
             )`
        )
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

    return NextResponse.json({ count: data?.length, data, error });
}