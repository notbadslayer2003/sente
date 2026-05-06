import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyCartGroups } from "@/lib/dal/cart";
import { CartGroupCard } from "@/components/sente/cart-group-card";


type SearchParams = Promise<{ cancelled?: string; order_id?: string }>;


export default async function PanierPage({
                                             searchParams,
                                         }: {
    searchParams: SearchParams;
}) {
    const sp = await searchParams;
    const wasCancelled = sp.cancelled === "1";
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login?next=/panier");

    const cartGroups = await getMyCartGroups();

    return (
        <section className="bg-background min-h-screen pt-24 pb-16">
            <div className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-12">
                <header className="mb-10">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Mon panier
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                        Panier.
                    </h1>
                    {cartGroups.length > 1 && (
                        <p className="mt-4 text-sm text-muted-foreground max-w-2xl">
                            Tu as des produits de plusieurs magasins. Chaque commande est
                            traitée séparément, avec son propre paiement.
                        </p>
                    )}
                </header>

                {wasCancelled && (
                    <div className="mb-8 border border-accent/40 bg-accent/5 p-4">
                        <p className="text-sm">
                            Tu as annulé le paiement. Ton panier est conservé, tu peux réessayer
                            quand tu veux.
                        </p>
                    </div>
                )}

                {cartGroups.length === 0 ? (
                    <EmptyCart />
                ) : (
                    <div className="space-y-8">
                        {cartGroups.map((group) => (
                            <CartGroupCard key={group.cart_id} group={group} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function EmptyCart() {
    return (
        <div className="border border-dashed border-border p-16 text-center">
            <p className="text-base">Ton panier est vide.</p>
            <p className="mt-3 text-xs text-muted-foreground">
                Découvre les boutiques des magasins partenaires.
            </p>
            <Link
                href="/magasins"
                className="mt-6 inline-block px-5 py-2.5 text-xs uppercase tracking-wide border border-border hover:bg-accent/10 hover:border-accent hover:text-accent transition-colors"
            >
                Voir les magasins →
            </Link>
        </div>
    );
}