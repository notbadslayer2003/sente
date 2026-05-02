import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    return {
        rules: [
            {
                userAgent: "*",
                allow: ["/", "/lieux", "/magasins", "/partenaires", "/contact"],
                disallow: [
                    "/dashboard",
                    "/admin",
                    "/api",
                    "/profil",
                    "/auth",
                    "/onboarding",
                    "/invitations",
                    "/login",
                    "/signup",
                ],
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}