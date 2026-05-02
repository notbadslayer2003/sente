import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/sente/site-header";

export default async function AdminLayout({
                                              children,
                                          }: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: admin } = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .single();

    if (!admin) redirect("/profil");

    return (
        <>
            <SiteHeader />
            <div className="bg-background min-h-screen pt-16">
                <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-8 lg:py-12">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                        <aside className="lg:col-span-3">
                            <div className="space-y-6">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                                        Admin Sente
                                    </p>
                                    <h2 className="mt-2 font-display text-2xl tracking-tight">
                                        Backoffice
                                    </h2>
                                </div>
                                <nav>
                                    <ul className="space-y-1">
                                        <li>
                                            <Link
                                                href="/admin/organizations"
                                                className="block px-3 py-2 text-sm uppercase tracking-wide hover:text-accent hover:bg-accent/5 transition-colors"
                                            >
                                                Organisations
                                            </Link>
                                        </li>
                                    </ul>
                                </nav>
                            </div>
                        </aside>
                        <main className="lg:col-span-9">{children}</main>
                    </div>
                </div>
            </div>
        </>
    );
}