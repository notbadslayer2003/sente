import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Heart, MessageCircle, AtSign, UserPlus, ShieldAlert, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/dal/notifications";
import { NotificationsActions } from "@/components/sente/notifications-actions";

export default async function NotificationsPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/notifications");

    const items = await getNotifications({ limit: 50 });
    const hasUnread = items.some((i) => !i.read_at);

    return (
        <section className="bg-background min-h-screen pt-24 pb-16">
            <div className="mx-auto max-w-2xl px-6 sm:px-8">
                <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                            Activité
                        </p>
                        <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                            Notifications.
                        </h1>
                    </div>
                    {hasUnread && <NotificationsActions />}
                </div>

                {items.length === 0 ? (
                    <div className="border border-dashed border-border p-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            Aucune notification pour le moment.
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-border border-y border-border">
                        {items.map((n) => (
                            <li key={n.id}>
                                <NotificationRow item={n} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}

function NotificationRow({
                             item,
                         }: {
    item: Awaited<ReturnType<typeof getNotifications>>[number];
}) {
    const { icon, message, href } = formatNotification(item);

    const content = (
        <div
            className={`flex items-start gap-3 px-4 py-4 hover:bg-secondary/30 transition-colors ${
                !item.read_at ? "bg-accent/5" : ""
            }`}
        >
            <div className="shrink-0 w-9 h-9 flex items-center justify-center bg-secondary border border-border">
                {icon}
            </div>
            {item.actor && (
                <Avatar
                    name={item.actor.name}
                    avatarUrl={item.actor.avatar_url}
                />
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed">{message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                    {formatRelative(item.created_at)}
                </p>
            </div>
            {!item.read_at && (
                <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-accent" />
            )}
        </div>
    );

    return href ? <Link href={href}>{content}</Link> : content;
}

function Avatar({
                    name,
                    avatarUrl,
                }: {
    name: string;
    avatarUrl: string | null;
}) {
    if (avatarUrl) {
        return (
            <div className="w-9 h-9 relative bg-secondary border border-border overflow-hidden shrink-0">
                <Image
                    src={avatarUrl}
                    alt={name}
                    fill
                    sizes="36px"
                    className="object-cover"
                    unoptimized
                />
            </div>
        );
    }
    const initials = name
        .split(" ")
        .map((s) => s[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    return (
        <div className="w-9 h-9 flex items-center justify-center bg-accent/10 text-accent text-[10px] font-medium uppercase tracking-wide shrink-0">
            {initials || "?"}
        </div>
    );
}

function formatNotification(
    item: Awaited<ReturnType<typeof getNotifications>>[number]
): { icon: React.ReactNode; message: React.ReactNode; href: string | null } {
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
            return {
                icon: <MessageCircle className="w-4 h-4" strokeWidth={2} />,
                message: (
                    <>
                        <strong>{actorName}</strong> a commenté ton post.
                    </>
                ),
                href: postHref,
            };
        case "reply_to_comment":
            return {
                icon: <MessageCircle className="w-4 h-4" strokeWidth={2} />,
                message: (
                    <>
                        <strong>{actorName}</strong> a répondu à ton commentaire.
                    </>
                ),
                href: postHref,
            };
        case "org_mentioned":
            return {
                icon: <AtSign className="w-4 h-4" strokeWidth={2} />,
                message: (
                    <>
                        <strong>{actorName}</strong> a mentionné <strong>{orgName}</strong> dans un post.
                    </>
                ),
                href: postHref,
            };
        case "new_follower":
            return {
                icon: <UserPlus className="w-4 h-4" strokeWidth={2} />,
                message: (
                    <>
                        <strong>{actorName}</strong> suit désormais <strong>{orgName}</strong>.
                    </>
                ),
                href: orgHref,
            };
        case "post_hidden_by_admin":
            return {
                icon: <ShieldAlert className="w-4 h-4" strokeWidth={2} />,
                message: (
                    <>
                        Ton post a été masqué par la modération.
                        {item.payload.note ? (
                            <>
                                {" "}
                                <span className="text-muted-foreground italic">
                  &laquo; {String(item.payload.note)} &raquo;
                </span>
                            </>
                        ) : null}
                    </>
                ),
                href: null,
            };
        case "comment_hidden":
            return {
                icon: <ShieldAlert className="w-4 h-4" strokeWidth={2} />,
                message: <>Ton commentaire a été masqué.</>,
                href: postHref,
            };
        case "account_action":
            return {
                icon: <AlertTriangle className="w-4 h-4" strokeWidth={2} />,
                message: (
                    <>
                        <strong>Action sur ton compte</strong>
                        {item.payload.note ? (
                            <>
                                {" — "}
                                <span className="text-muted-foreground italic">
                  {String(item.payload.note)}
                </span>
                            </>
                        ) : null}
                    </>
                ),
                href: null,
            };
        default:
            return {
                icon: <Heart className="w-4 h-4" strokeWidth={2} />,
                message: <>Activité.</>,
                href: null,
            };
    }
}

function formatRelative(d: string): string {
    const date = new Date(d);
    const now = new Date();
    const diffMin = Math.round((now.getTime() - date.getTime()) / 60000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 24) return `il y a ${diffHour} h`;
    const diffDay = Math.round(diffHour / 24);
    if (diffDay < 7) return `il y a ${diffDay} j`;
    return date.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
}