"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    publishListing,
    unpublishListing,
    deleteListing,
    renewListing,
} from "@/app/actions/marketplace/listings";
import type { MarketplaceListingStatus } from "@/lib/dal/marketplace-listings";

// =============================================================================
// ListingActions — actions contextuelles sur une ligne de listing (vue vendeur)
// =============================================================================
// Actions disponibles selon le statut. Style minimal aligné sur le pattern
// "actions de ligne" du projet (cf. RegistreManager).
// =============================================================================

type ServerActionResult =
    | { ok: true; data: unknown }
    | { ok: false; error: { code: string; message: string } };

export function ListingActions({
                                   listingId,
                                   status,
                               }: {
    listingId: string;
    status: MarketplaceListingStatus;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    function handle(action: () => Promise<ServerActionResult>) {
        startTransition(async () => {
            const result = await action();
            if (!result.ok) {
                alert(result.error.message);
                return;
            }
            router.refresh();
        });
    }

    function handleDelete() {
        if (!confirm("Supprimer définitivement cette annonce ?")) return;
        handle(() => deleteListing(listingId));
    }

    const canEdit = status !== "removed" && status !== "sold";
    const canPublish = status === "draft";
    const canUnpublish = status === "active" || status === "pending_review";
    const canRenew = status === "active" || status === "expired";
    const canDelete = status !== "sold";

    return (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-start sm:justify-end">
            {canPublish && (
                <button
                    type="button"
                    onClick={() => handle(() => publishListing(listingId))}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                >
                    Publier
                </button>
            )}

            {canUnpublish && (
                <button
                    type="button"
                    onClick={() => handle(() => unpublishListing(listingId))}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Dépublier
                </button>
            )}

            {canRenew && (
                <button
                    type="button"
                    onClick={() => handle(() => renewListing(listingId))}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                    Renouveler 60j
                </button>
            )}

            {canEdit && (
                <Link
                    href={`/profil/marketplace/annonces/${listingId}`}
                    className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                >
                    Modifier
                </Link>
            )}

            {canDelete && (
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isPending}
                    className="text-xs uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                    Supprimer
                </button>
            )}
        </div>
    );
}