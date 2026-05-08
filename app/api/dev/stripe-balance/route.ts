import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";

export const runtime = "nodejs";

export async function GET() {
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available" }, { status: 403 });
    }
    const stripe = getStripeClient();
    const balance = await stripe.balance.retrieve();
    return NextResponse.json(balance);
}