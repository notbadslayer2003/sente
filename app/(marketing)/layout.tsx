import { SiteHeader } from "@/components/sente/site-header";
import { SiteFooter } from "@/components/sente/site-footer";

export default function MarketingLayout({
                                            children,
                                        }: {
    children: React.ReactNode;
}) {
    return (
        <>
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
        </>
    );
}