import Link from "next/link";

// ============================================================
// SiteFooter
//
// Port du <Footer /> du design Claude (shared.jsx).
//
// Structure :
// - Section ink (noir profond), texte blanc
// - Top : flex desktop, stack mobile
//   - Gauche : H3 newsletter + pitch + form email/submit
//   - Droite : grid 4 colonnes de liens (Produit, Bientôt, Sente, Légal)
// - Bottom : copyright + tagline, border-top fine
//
// La newsletter utilise un Server Action inline pour le submit.
// Aucune persistance pour l'instant — TODO clair (table newsletter_signups,
// Server Action propre, email confirmation Resend).
//
// Note : URLs du design conservées telles quelles (Mathis les adaptera).
// ============================================================

type LinkItem = { label: string; href: string };

const LINK_COLUMNS: { title: string; items: LinkItem[] }[] = [
    {
        title: "Produit",
        items: [
            { label: "Marketplace", href: "/marketplace" },
            { label: "Étangs",      href: "/etangs" },
            { label: "Magasins",    href: "/magasins" },
        ],
    },
    {
        title: "Bientôt",
        items: [
            { label: "Étangs (waitlist)",   href: "/#waitlist" },
            { label: "Magasins (waitlist)", href: "/#waitlist" },
        ],
    },
    {
        title: "Sente",
        items: [
            { label: "Manifeste", href: "#" },
            { label: "Équipe",    href: "#" },
            { label: "Presse",    href: "#" },
        ],
    },
    {
        title: "Légal",
        items: [
            { label: "CGU",             href: "#" },
            { label: "Confidentialité", href: "#" },
            { label: "Cookies",         href: "#" },
        ],
    },
];

export function SiteFooter() {
    // Server Action inline pour le submit newsletter.
    // TODO : remplacer le no-op par :
    //   1. Validation Zod (email format, longueur)
    //   2. Rate limit Upstash (newsletter:<ip>)
    //   3. Insert dans newsletter_signups (table à créer en migration 0003)
    //   4. Resend : email double opt-in
    //   5. Sentry log si erreur
    async function subscribeNewsletter(formData: FormData) {
        "use server";
        const email = formData.get("email");
        // Stub : on logue juste pour visibilité dev, à virer en prod.
        console.log("[newsletter] subscribe stub", { email });
    }

    return (
        <footer className="bg-ink text-white">
            <div className="px-6 pt-16 pb-8 md:px-14 md:pt-[72px]">

                {/* ===== TOP : newsletter + colonnes de liens ===== */}
                <div className="flex flex-col lg:flex-row justify-between items-start gap-12 lg:gap-20 mb-14">

                    {/* ----- Newsletter (gauche) ----- */}
                    <div className="max-w-[480px] w-full">
                        <h3
                            className="font-body font-medium m-0
                         text-3xl md:text-[40px]
                         leading-[1.1] tracking-[-0.03em]"
                        >
                            La newsletter Sente, tous les dimanches.
                        </h3>

                        <p className="font-body text-sm text-white/65 mt-3.5 leading-[1.5]">
                            Trois étangs sélectionnés, deux conseils saison, une histoire de
                            pêcheur. Pas de pub, jamais.
                        </p>

                        <form action={subscribeNewsletter} className="flex gap-2 mt-[22px]">
                            <input
                                type="email"
                                name="email"
                                required
                                maxLength={160}
                                placeholder="ton@email.be"
                                aria-label="Email pour la newsletter"
                                className="flex-1 min-w-0
                           px-[18px] py-3 rounded-full
                           border border-white/20 bg-white/5
                           text-white placeholder:text-white/40
                           font-body text-sm
                           outline-none transition-colors duration-200
                           focus:border-white/50 focus:bg-white/[0.08]"
                            />
                            <button
                                type="submit"
                                className="shrink-0 bg-white text-ink rounded-full
                           px-[22px] py-3
                           font-body font-medium text-sm
                           cursor-pointer transition-colors duration-200
                           hover:bg-white/90
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                            >
                                S&apos;abonner
                            </button>
                        </form>
                    </div>

                    {/* ----- Colonnes de liens (droite) ----- */}
                    <div
                        className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-10 md:gap-x-16
                       font-body text-sm text-white/75"
                    >
                        {LINK_COLUMNS.map((col) => (
                            <FooterCol key={col.title} title={col.title}>
                                {col.items.map((item) => (
                                    <FooterLink key={item.label} href={item.href}>
                                        {item.label}
                                    </FooterLink>
                                ))}
                            </FooterCol>
                        ))}
                    </div>
                </div>

                {/* ===== BOTTOM : copyright + tagline ===== */}
                <div
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3
                     pt-[22px] border-t border-white/10
                     font-body text-xs text-white/50"
                >
                    <span>© {new Date().getFullYear()} Sente · Made in Wallonia</span>
                    <div className="flex gap-6">
                        <span>Status</span>
                        <span>Manifeste</span>
                        <span>v0.4</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}

// ------------------------------------------------------------
// Sous-composants
// ------------------------------------------------------------

function FooterCol({
                       title,
                       children,
                   }: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div
                className="font-body text-[11px] font-medium uppercase tracking-[0.12em]
                   text-white/50 mb-3.5"
            >
                {title}
            </div>
            <ul className="flex flex-col gap-2.5 m-0 p-0 list-none">
                {children}
            </ul>
        </div>
    );
}

function FooterLink({
                        href,
                        children,
                    }: {
    href: string;
    children: React.ReactNode;
}) {
    return (
        <li>
            <Link
                href={href}
                prefetch={false}
                className="text-white/75 hover:text-white no-underline transition-colors duration-200"
            >
                {children}
            </Link>
        </li>
    );
}