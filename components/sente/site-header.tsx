import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/sente/user-menu";
import { GlobalSearch } from "@/components/sente/global-search";
import { getUnreadNotificationCount } from "@/lib/dal/notifications";
import { getMyCartItemsCount } from "@/lib/dal/cart";
import { CartWidget } from "@/components/sente/cart-widget";
import { NotificationsWidget } from "@/components/sente/notifications-widget";

export async function SiteHeader() {
    const supabase = await createClient();

    // 1 seul roundtrip Auth.
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Parallélise les 2 queries badges (uniquement si user connecté).
    const [unreadCount, cartItemsCount] = user
        ? await Promise.all([
            getUnreadNotificationCount(),
            getMyCartItemsCount(),
        ])
        : [0, 0];

    // Lecture du nom depuis le JWT (gratuit), plus de query profiles.
    // Garde-fou : on garde un fallback sur l'email si user_metadata vide.
    const displayName =
        (user?.user_metadata?.full_name as string | undefined) ??
        user?.email ??
        null;

    return (
        <header className="fixed top-0 inset-x-0 z-50 bg-background border-b border-border">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
                <Link
                    href="/"
                    prefetch={false}
                    className="font-display text-2xl tracking-tight text-foreground hover:text-accent transition-colors"
                >
                    Sente
                </Link>
                <nav className="flex items-center gap-6 sm:gap-8 text-sm">
                    <Link
                        href="/lieux"
                        prefetch={false}
                        className="hidden sm:inline-flex text-foreground hover:text-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        Étangs
                    </Link>
                    <Link
                        href="/magasins"
                        prefetch={false}
                        className="hidden sm:inline-flex text-foreground hover:text-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        Magasins
                    </Link>
                    <Link
                        href="/marketplace"
                        prefetch={false}
                        className="hidden md:inline-flex text-foreground hover:text-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        Marketplace
                    </Link>
                    <Link
                        href="/evenements"
                        prefetch={false}
                        className="hidden md:inline-flex text-foreground hover:text-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        Événements
                    </Link>
                    <Link
                        href="/feed"
                        prefetch={false}
                        className="hidden md:inline-flex text-foreground hover:text-accent transition-colors uppercase tracking-wide text-xs"
                    >
                        Feed
                    </Link>

                    <GlobalSearch />
                    {user && <NotificationsWidget unreadCount={unreadCount} />}
                    {user && <CartWidget itemsCount={cartItemsCount} />}
                    {user ? (
                        <UserMenu displayName={displayName} email={user.email ?? ""} />
                    ) : (
                        <>
                            <Link
                                href="/login"
                                prefetch={false}
                                className="text-foreground/70 hover:text-accent transition-colors uppercase tracking-wide text-xs"
                            >
                                Connexion
                            </Link>
                            <Link
                                href="/signup"
                                prefetch={false}
                                className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-4 py-2 uppercase tracking-wide text-xs font-medium"
                            >
                                Créer un compte
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}