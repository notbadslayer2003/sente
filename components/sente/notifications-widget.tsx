"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
    Bell, Heart, MessageCircle, AtSign, UserPlus,
    ShieldAlert, AlertTriangle, ShoppingBag, Package,
    Truck, RotateCcw, Ticket, Check, CheckCheck,
} from "lucide-react";
import {
    getNotificationsAction,
    markNotificationReadAction,
    markAllNotificationsReadAction,
} from "@/app/actions/notifications";
import type { NotificationItem } from "@/lib/dal/notifications";

// Réutilisé depuis notifications/page.tsx
function getNotifMeta(item: NotificationItem): {
    icon: React.ReactNode;
    message: React.ReactNode;
    href: string | null;
} {
    const actorName = item.actor?.name ?? "Quelqu'un";
    const orgName = item.target_org?.name ?? "ton organisation";
    const orgHref = item.target_org
        ? item.target_org.org_type === "etang"
            ? `/lieux/${item.target_org.slug}`
            : `/magasins/${item.target_org.slug}`
        : null;
    const postHref = item.target_post_id ? `/post/${item.target_post_id}` : null;

    switch (item.type) {
        case "comment_on_post":
            return { icon: <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />, message: <><strong>{actorName}</strong> a commenté ton post.</>, href: postHref };
        case "reply_to_comment":
            return { icon: <MessageCircle className="w-3.5 h-3.5" strokeWidth={2} />, message: <><strong>{actorName}</strong> a répondu à ton commentaire.</>, href: postHref };
        case "org_mentioned":
            return { icon: <AtSign className="w-3.5 h-3.5" strokeWidth={2} />, message: <><strong>{actorName}</strong> a mentionné <strong>{orgName}</strong>.</>, href: postHref };
        case "new_follower":
            return { icon: <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />, message: <><strong>{actorName}</strong> suit <strong>{orgName}</strong>.</>, href: orgHref };
        case "post_hidden_by_admin":
            return { icon: <ShieldAlert className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Ton post a été masqué par la modération.</>, href: null };
        case "comment_hidden":
            return { icon: <ShieldAlert className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Ton commentaire a été masqué.</>, href: postHref };
        case "account_action": {
            const action = String(item.payload.action ?? "");
            const orgSlug = item.target_org?.slug ?? null;
            const orderId = String(item.payload.order_id ?? "");
            if (action === "magasin_new_order") return { icon: <ShoppingBag className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Nouvelle commande sur ta boutique.</>, href: orgSlug && orderId ? `/dashboard/${orgSlug}/commandes/${orderId}` : null };
            if (action === "order_ready_for_pickup") return { icon: <Package className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Ta commande chez <strong>{orgName}</strong> est prête.</>, href: orderId ? `/profil/commandes/${orderId}` : `/profil/commandes` };
            if (action === "order_shipped") return { icon: <Truck className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Ta commande chez <strong>{orgName}</strong> a été expédiée.</>, href: orderId ? `/profil/commandes/${orderId}` : `/profil/commandes` };
            if (action === "order_refund" || action === "order_shipping_refund") return { icon: <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Remboursement sur ta commande chez <strong>{orgName}</strong>.</>, href: orderId ? `/profil/commandes/${orderId}` : `/profil/commandes` };
            if (action === "event_registration_paid") return { icon: <Ticket className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Inscription confirmée chez <strong>{orgName}</strong>.</>, href: `/profil/inscriptions` };
            if (action === "event_refund") return { icon: <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Remboursement d'inscription chez <strong>{orgName}</strong>.</>, href: `/profil/inscriptions` };
            return { icon: <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Action sur ton compte.</>, href: null };
        }
        default:
            return { icon: <Heart className="w-3.5 h-3.5" strokeWidth={2} />, message: <>Activité.</>, href: null };
    }
}

function formatRelative(d: string): string {
    const diffMin = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `${diffMin} min`;
    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 24) return `${diffHour} h`;
    return `${Math.round(diffHour / 24)} j`;
}

export function NotificationsWidget({ unreadCount: initialCount }: { unreadCount: number }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(initialCount);
    const [isPending, startTransition] = useTransition();
    const ref = useRef<HTMLDivElement>(null);

    const fetchNotifs = async () => {
        setLoading(true);
        const data = await getNotificationsAction({ limit: 10 });
        setItems(data);
        setUnreadCount(data.filter((n) => !n.read_at).length);
        setLoading(false);
    };

    useEffect(() => {
        if (open) fetchNotifs();
    }, [open]);

    // Fermeture clic extérieur
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        if (open) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const onMarkOne = (id: string) => {
        const fd = new FormData();
        fd.set("notification_id", id);
        startTransition(async () => {
            await markNotificationReadAction(fd);
            // Mise à jour optimiste locale
            setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
            setUnreadCount((c) => Math.max(0, c - 1));
        });
    };

    const onMarkAll = () => {
        startTransition(async () => {
            await markAllNotificationsReadAction();
            setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
            setUnreadCount(0);
        });
    };

    return (
        <div ref={ref} className="relative">
            {/* Bouton cloche */}
            <button
                onClick={() => setOpen((o) => !o)}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
                className="relative p-2 hover:bg-secondary transition-colors rounded-full"
            >
                <Bell className="w-4 h-4" strokeWidth={2} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-destructive text-background text-[10px] font-medium tabular-nums rounded-full flex items-center justify-center">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border shadow-lg z-50 flex flex-col max-h-[480px]">
                    {/* Header dropdown */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                            Notifications
                        </p>
                        {unreadCount > 0 && (
                            <button
                                onClick={onMarkAll}
                                disabled={isPending}
                                title="Tout marquer comme lu"
                                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-accent transition-colors disabled:opacity-50"
                            >
                                <CheckCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                                Tout lu
                            </button>
                        )}
                    </div>

                    {/* Liste */}
                    <div className="overflow-y-auto flex-1">
                        {loading ? (
                            <p className="px-4 py-6 text-xs text-muted-foreground text-center">Chargement...</p>
                        ) : items.length === 0 ? (
                            <p className="px-4 py-8 text-xs text-muted-foreground text-center">Aucune notification.</p>
                        ) : (
                            <ul className="divide-y divide-border">
                                {items.map((item) => {
                                    const { icon, message, href } = getNotifMeta(item);
                                    const isUnread = !item.read_at;

                                    const inner = (
                                        <div className={`flex items-start gap-3 px-4 py-3 group ${isUnread ? "bg-accent/5" : ""} hover:bg-secondary/30 transition-colors`}>
                                            {/* Icône type */}
                                            <div className="shrink-0 w-7 h-7 flex items-center justify-center bg-secondary border border-border mt-0.5">
                                                {icon}
                                            </div>
                                            {/* Texte */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs leading-relaxed">{message}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    {formatRelative(item.created_at)}
                                                </p>
                                            </div>
                                            {/* Marquer comme lu */}
                                            <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                                                {isUnread ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            onMarkOne(item.id);
                                                        }}
                                                        disabled={isPending}
                                                        title="Marquer comme lu"
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-accent disabled:opacity-30"
                                                    >
                                                        <Check className="w-3.5 h-3.5" strokeWidth={2} />
                                                    </button>
                                                ) : null}
                                                {isUnread && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                    );

                                    return (
                                        <li key={item.id}>
                                            {href ? (
                                                <Link href={href} onClick={() => setOpen(false)}>
                                                    {inner}
                                                </Link>
                                            ) : (
                                                inner
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-border px-4 py-3">
                        <Link
                            href="/notifications"
                            onClick={() => setOpen(false)}
                            className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-accent transition-colors"
                        >
                            Voir toutes les notifications →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}