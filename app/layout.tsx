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
    title: "Sente — Pêche · Wallonie & France",
    description:
        "L'annuaire des étangs et des magasins. La communauté qui fait vivre la pêche en Wallonie et en France.",
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