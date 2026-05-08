import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyThreads } from "@/lib/dal/marketplace-threads";
import { getMarketplacePublicUrl } from "@/lib/storage/marketplace-r2";

// =============================================================================
// Page : /profil/marketplace/messages
// =============================================================================
// Liste des conversations du user (buyer + seller mélangés), triées par
// dernière activité (last_message_at desc côté DAL).
// =============================================================================

function formatPrice(cents: number): string {
    return (cents / 100).toLocaleString("fr-BE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
    });
}

function formatRelativeTime(iso: string): string {
    const date = new Date(iso);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} j`;
    return date.toLocaleDateString("fr-BE", {
        day: "2-digit",
        month: "2-digit",
    });
}

export default async function MarketplaceMessagesPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const threads = await getMyThreads();

    return (
        <div className="space-y-12">
            {/* Header */}
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Marketplace
                </p>
                <h1 className="mt-3 font-display text-4xl tracking-tight leading-[1.05]">
                    Messages
                </h1>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Tes conversations en cours avec acheteurs et vendeurs.{" "}
                    {threads.length > 0 && (
                        <span className="text-foreground">
                            {threads.length}{" "}
                            {threads.length === 1 ? "conversation" : "conversations"}.
                        </span>
                    )}
                </p>
            </div>

            {/* Liste */}
            {threads.length === 0 ? (
                <div className="border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        Aucune conversation pour le moment.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Les messages apparaîtront ici dès qu&apos;un acheteur te contacte
                        ou que tu écris à un vendeur.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-border border-y border-border">
                    {threads.map((t) => {
                        const isBuyer = t.buyer_user_id === user.id;
                        const counterparty = isBuyer ? t.seller : t.buyer;
                        const firstPhoto = t.listing?.photos[0];
                        const photoUrl = firstPhoto
                            ? getMarketplacePublicUrl(firstPhoto.storage_path)
                            : null;
                        const lastMsg = t.last_message;
                        const lastIsMine = lastMsg?.sender_user_id === user.id;

                        return (
                            <li key={t.id}>
                                <Link
                                    href={`/profil/marketplace/messages/${t.id}`}
                                    className="group flex items-start gap-5 py-5"
                                >
                                    {/* Photo */}
                                    {photoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={photoUrl}
                                            alt={t.listing?.title ?? ""}
                                            className="h-20 w-20 flex-shrink-0 object-cover border border-border"
                                        />
                                    ) : (
                                        <div className="h-20 w-20 flex-shrink-0 border border-border bg-secondary/40" />
                                    )}

                                    {/* Contenu */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <p className="truncate font-display text-base leading-tight group-hover:text-accent transition-colors">
                                                {t.listing?.title ?? "Annonce supprimée"}
                                            </p>
                                            <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                                {formatRelativeTime(t.last_message_at)}
                                            </span>
                                        </div>

                                        {/* Métadonnées */}
                                        <div className="mt-2 flex items-center gap-2 text-xs">
                                            <span
                                                className={`text-[10px] uppercase tracking-[0.2em] px-1.5 py-0.5 ${
                                                    isBuyer
                                                        ? "bg-accent/10 text-accent"
                                                        : "bg-primary/10 text-primary"
                                                }`}
                                            >
                                                {isBuyer ? "Vendeur" : "Acheteur"}
                                            </span>
                                            <span className="truncate text-muted-foreground">
                                                {counterparty?.full_name ?? "—"}
                                            </span>
                                            {t.listing && (
                                                <>
                                                    <span className="text-border">·</span>
                                                    <span className="font-display tracking-tight">
                                                        {formatPrice(t.listing.price_cents)}
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Dernier message */}
                                        {lastMsg && (
                                            <p className="mt-2 truncate text-sm text-muted-foreground">
                                                {lastIsMine && (
                                                    <span className="text-foreground/50">Toi : </span>
                                                )}
                                                {lastMsg.body}
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}