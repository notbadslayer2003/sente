import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        url_present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        anon_present: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        service_role_present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
}