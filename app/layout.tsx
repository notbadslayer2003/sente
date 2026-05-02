import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
    subsets: ["latin"],
    variable: "--font-display",
    display: "swap",
});

const geist = Geist({
    subsets: ["latin"],
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
        <html lang="fr" className={`${fraunces.variable} ${geist.variable}`}>
        <body className="font-body bg-background text-foreground antialiased">
        {children}
        </body>
        </html>
    );
}