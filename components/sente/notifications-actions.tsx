"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsReadAction } from "@/app/actions/notifications";

export function NotificationsActions() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const onMarkAll = () => {
        startTransition(async () => {
            await markAllNotificationsReadAction();
            router.refresh();
        });
    };

    return (
        <button
            type="button"
            onClick={onMarkAll}
            disabled={isPending}
            className="text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
            {isPending ? "..." : "Tout marquer comme lu"}
        </button>
    );
}