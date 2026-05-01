import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
    subsets: ["latin"],
    variable: "--font-display",
    axes: ["SOFT", "WONK", "opsz"],
    display: "swap",
});

const geist = Geist({
    subsets: ["latin"],
    variable: "--font-body",
    display: "swap",
});

export const metadata: Metadata = {
    title: {
        default: "Sente — Pêche & chasse en Wallonie",
        template: "%s — Sente",
    },
    description:
        "L'annuaire de la pêche et de la chasse en Wallonie. Lieux, magasins, exploitants — au même endroit.",
    metadataBase: new URL("https://sente.app"),
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="fr" className={`${fraunces.variable} ${geist.variable}`}>
        <body className="bg-background text-foreground font-body antialiased">
        {children}
        </body>
        </html>
    );
}