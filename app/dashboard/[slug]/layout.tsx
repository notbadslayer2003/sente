import { getDashboardContext } from "@/lib/dal/dashboard";
import { DashboardSidebar } from "@/components/sente/dashboard-sidebar";

type Params = Promise<{ slug: string }>;

export default async function DashboardLayout({
                                                  children,
                                                  params,
                                              }: {
    children: React.ReactNode;
    params: Params;
}) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    return (
        <div className="bg-background min-h-screen pt-16">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-8 lg:py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    <aside className="lg:col-span-3">
                        <DashboardSidebar
                            slug={ctx.org.slug}
                            orgName={ctx.org.name}
                            orgType={ctx.org.org_type}
                            orgStatus={ctx.org.status}
                            role={ctx.role}
                        />
                    </aside>
                    <main className="lg:col-span-9">{children}</main>
                </div>
            </div>
        </div>
    );
}