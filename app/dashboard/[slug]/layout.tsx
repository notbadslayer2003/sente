import { getDashboardContext } from "@/lib/dal/dashboard";
import { getOrgPlanInfo } from "@/lib/dal/plan";
import {
    ETANG_PLANS,
    MAGASIN_PLANS,
} from "@/lib/constants/plans";
import { DashboardSidebar } from "@/components/sente/dashboard-sidebar";
import { UpgradeBannerDashboard } from "@/components/sente/upgrade-banner-dashboard";

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
    const planInfo = await getOrgPlanInfo(ctx.org.id);

    // On affiche le bandeau seulement si :
    // - le plan actuel est le plan gratuit (priceCents === 0)
    // - et un plan supérieur existe (qui est le cas pour vitrine→crm et starter→pro)
    const showUpgradeBanner =
        planInfo !== null && planInfo.plan.priceCents === 0;

    const upgradePlan = !showUpgradeBanner
        ? null
        : planInfo.orgType === "etang"
            ? ETANG_PLANS.crm
            : MAGASIN_PLANS.pro;

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
                    <main className="lg:col-span-9 space-y-6">
                        {showUpgradeBanner && upgradePlan && planInfo && (
                            <UpgradeBannerDashboard
                                slug={ctx.org.slug}
                                currentPlan={planInfo.plan}
                                upgradePlan={upgradePlan}
                            />
                        )}
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}