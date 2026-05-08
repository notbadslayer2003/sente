import { NextResponse, type NextRequest } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available" }, { status: 403 });
    }
    const dest = req.nextUrl.searchParams.get("dest");
    if (!dest) return NextResponse.json({ error: "?dest=acct_xxx requis" }, { status: 400 });

    const stripe = getStripeClient();
    const transfers = await stripe.transfers.list({ destination: dest, limit: 10 });
    return NextResponse.json(transfers);
}