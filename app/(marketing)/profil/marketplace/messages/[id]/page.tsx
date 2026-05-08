import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getThread } from "@/lib/dal/marketplace-threads";
import { getMarketplacePublicUrl } from "@/lib/storage/marketplace-r2";
import { buildListingUrl } from "@/lib/marketplace/listing-url";
import { MarketplaceThreadConversation } from "@/components/sente/marketplace-thread-conversation";

// =============================================================================
// Page : /profil/marketplace/messages/[id]
// =============================================================================
// Vue d'une conversation : header + bandeau listing + timeline (messages
// & offres) + input. Le layout profil cadre déjà la page.
// =============================================================================

function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString("fr-BE", {
        style: "currency",
        currency: "EUR",
    });
}

const LISTING_STATUS_LABEL: Record<string, string> = {
    active: "Active",
    reserved: "Réservée",
    sold: "Vendue",
    expired: "Expirée",
    removed: "Retirée",
    pending_review: "En modération",
    draft: "Brouillon",
};

export default async function ThreadConversationPage({
                                                         params,
                                                     }: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const thread = await getThread(id);
    if (!thread) notFound();

    const isBuyer = thread.buyer_user_id === user.id;
    const counterparty = isBuyer ? thread.seller : thread.buyer;

    const listingPhotoUrl = thread.listing?.photos[0]
        ? getMarketplacePublicUrl(thread.listing.photos[0].storage_path)
        : null;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Marketplace · Conversation
                </p>
                <h1 className="mt-3 font-display text-3xl tracking-tight leading-[1.1]">
                    {thread.listing?.title ?? "Annonce supprimée"}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    Avec{" "}
                    <span className="text-foreground">
                        {counterparty?.full_name ?? "Utilisateur"}
                    </span>
                    {" · "}
                    <span
                        className={`inline-block text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 align-middle ${
                            isBuyer
                                ? "bg-accent/10 text-accent"
                                : "bg-primary/10 text-primary"
                        }`}
                    >
                        {isBuyer ? "Vendeur" : "Acheteur"}
                    </span>
                </p>
            </div>

            {/* Bandeau listing (si encore présent) */}
            {thread.listing && (
                <Link
                    href={buildListingUrl({
                        id: thread.listing.id,
                        title: thread.listing.title,
                    })}
                    className="group flex items-center gap-5 border border-border bg-secondary/20 p-4 hover:bg-secondary/40 transition-colors"
                >
                    {listingPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={listingPhotoUrl}
                            alt={thread.listing.title}
                            className="h-16 w-16 flex-shrink-0 object-cover border border-border"
                        />
                    ) : (
                        <div className="h-16 w-16 flex-shrink-0 border border-border bg-background" />
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                            Annonce
                        </p>
                        <p className="mt-1 truncate text-sm group-hover:text-accent transition-colors">
                            {thread.listing.title}
                        </p>
                        <p className="mt-1 font-display text-lg tracking-tight">
                            {formatPrice(thread.listing.price_cents)}
                        </p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {LISTING_STATUS_LABEL[thread.listing.status] ?? thread.listing.status}
                    </span>
                </Link>
            )}

            {/* Timeline + input */}
            <MarketplaceThreadConversation
                threadId={thread.id}
                currentUserId={user.id}
                isBuyer={isBuyer}
                listingPriceCents={thread.listing?.price_cents ?? 0}
                listingStatus={thread.listing?.status ?? "active"}
                messages={thread.messages.map((m) => ({
                    id: m.id,
                    sender_user_id: m.sender_user_id,
                    body: m.body,
                    created_at: m.created_at,
                    flagged:
                        m.filtered_flags !== null &&
                        (((m.filtered_flags as { emails?: string[]; phones?: string[] })
                                .emails?.length ?? 0) > 0 ||
                            ((m.filtered_flags as { emails?: string[]; phones?: string[] })
                                .phones?.length ?? 0) > 0),
                }))}
                offers={thread.offers.map((o) => ({
                    id: o.id,
                    buyer_user_id: o.buyer_user_id,
                    amount_cents: o.amount_cents,
                    status: o.status,
                    created_at: o.created_at,
                }))}
            />
        </div>
    );
}