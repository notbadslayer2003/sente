import { SiteHeader } from "@/components/sente/site-header";

export default function DashboardRootLayout({
                                                children,
                                            }: {
    children: React.ReactNode;
}) {
    return (
        <>
            <SiteHeader />
            {children}
        </>
    );
}