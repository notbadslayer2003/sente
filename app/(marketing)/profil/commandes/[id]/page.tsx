import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrderForBuyer, getOrderRefundsHistory } from "@/lib/dal/orders";
import { OrderBuyerDetailView } from "@/components/sente/order-buyer-detail-view";

type Params = Promise<{ id: string }>;

export default async function OrderBuyerDetailPage({
                                                       params,
                                                   }: {
    params: Params;
}) {
    const { id } = await params;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect(`/login?next=/profil/commandes/${id}`);

    const [order, refunds] = await Promise.all([
        getOrderForBuyer(id, user.id),
        getOrderRefundsHistory(id),
    ]);

    if (!order) notFound();

    return (
        <section className="bg-background min-h-screen pb-16">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                <Link
                    href="/profil/commandes"
                    className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                    Toutes mes commandes
                </Link>

                <OrderBuyerDetailView order={order} refunds={refunds} />
            </div>
        </section>
    );
}