import { notFound } from "next/navigation";
import Link from "next/link";
import { getDashboardContext } from "@/lib/dal/dashboard";
import { getOrderForMagasin } from "@/lib/dal/orders";
import { OrderDetailView } from "@/components/sente/order-detail-view";

type Params = Promise<{ slug: string; id: string }>;

export default async function CommandeDetailPage({
                                                     params,
                                                 }: {
    params: Params;
}) {
    const { slug, id } = await params;
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

    const order = await getOrderForMagasin(id);
    if (!order) notFound();
    if (order.magasin_id !== ctx.org.id) notFound();

    return (
        <div className="space-y-6">
            <nav className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <Link
                    href={`/dashboard/${slug}/commandes`}
                    className="hover:text-accent transition-colors"
                >
                    Commandes
                </Link>
                <span className="mx-2">›</span>
                <span className="text-foreground font-mono">
                    #{order.id.slice(0, 8).toUpperCase()}
                </span>
            </nav>

            <OrderDetailView slug={slug} order={order} />
        </div>
    );
}