import { NextResponse, type NextRequest } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available" }, { status: 403 });
    }

    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
        return NextResponse.json({ error: "?userId=... requis" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: sellerAcc } = await admin
        .from("marketplace_seller_accounts")
        .select("stripe_account_id, kyc_status, stripe_payouts_enabled, stripe_charges_enabled, stripe_details_submitted")
        .eq("user_id", userId)
        .single();

    if (!sellerAcc?.stripe_account_id) {
        return NextResponse.json({ error: "No stripe account" }, { status: 404 });
    }

    const stripe = getStripeClient();
    const account = await stripe.accounts.retrieve(sellerAcc.stripe_account_id);

    return NextResponse.json({
        sente_db: sellerAcc,
        stripe: {
            id: account.id,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            capabilities: account.capabilities,
            requirements: {
                disabled_reason: account.requirements?.disabled_reason,
                currently_due: account.requirements?.currently_due,
                past_due: account.requirements?.past_due,
                pending_verification: account.requirements?.pending_verification,
            },
            country: account.country,
            default_currency: account.default_currency,
        },
    });
}