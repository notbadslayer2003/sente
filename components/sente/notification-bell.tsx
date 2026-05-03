"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationsBell({ unreadCount }: { unreadCount: number }) {
    return (
        <Link
            href="/notifications"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
            className="relative p-2 hover:bg-secondary transition-colors rounded-full"
        >
            <Bell className="w-4 h-4" strokeWidth={2} />
            {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-destructive text-background text-[10px] font-medium tabular-nums rounded-full flex items-center justify-center">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
            )}
        </Link>
    );
}