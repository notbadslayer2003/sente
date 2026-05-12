import type { Metadata } from "next";
import {Fraunces, Geist, Inter_Tight, Libre_Caslon_Text} from "next/font/google";
import "./globals.css";

// ---- Body : Inter Tight ----
// Le design utilise 400/500/600/700. On charge uniquement ce qui sert
// pour ne pas plomber le LCP (chaque poids = +20-40 ko sur la font).
const interTight = Inter_Tight({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-body",
    display: "swap",
});

export const metadata: Metadata = {
    title: {
        default: "Sente — la communauté pêche",
        template: "%s | Sente",
    },
    description:
        "Découvre les étangs et magasins de pêche en Wallonie et France. Communauté, événements, e-commerce.",
    metadataBase: new URL(
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
    ),
    openGraph: {
        type: "website",
        locale: "fr_BE",
        siteName: "Sente",
    },
    twitter: {
        card: "summary_large_image",
    },
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="fr"
              className={`${interTight.variable}`}
        >
        <body className="font-body bg-background text-foreground antialiased">
        {children}
        </body>
        </html>
    );
}