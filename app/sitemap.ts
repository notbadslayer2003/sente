import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    // Pages statiques
    const staticRoutes: MetadataRoute.Sitemap = [
        { url: `${baseUrl}/`, changeFrequency: "weekly", priority: 1.0 },
        { url: `${baseUrl}/lieux`, changeFrequency: "weekly", priority: 0.9 },
        {
            url: `${baseUrl}/magasins`,
            changeFrequency: "weekly",
            priority: 0.9,
        },
        {
            url: `${baseUrl}/partenaires`,
            changeFrequency: "monthly",
            priority: 0.7,
        },
        { url: `${baseUrl}/contact`, changeFrequency: "yearly", priority: 0.5 },
        {
            url: `${baseUrl}/cgu`,
            changeFrequency: "yearly",
            priority: 0.3,
        },
        {
            url: `${baseUrl}/confidentialite`,
            changeFrequency: "yearly",
            priority: 0.3,
        },
        {
            url: `${baseUrl}/mentions-legales`,
            changeFrequency: "yearly",
            priority: 0.3,
        },
        {
            url: `${baseUrl}/cookies`,
            changeFrequency: "yearly",
            priority: 0.3,
        },
    ];

    // Pages dynamiques (étangs + magasins actifs)
    const admin = createAdminClient();
    const { data: orgs } = await admin
        .from("organizations")
        .select("slug, org_type, updated_at")
        .eq("status", "active")
        .is("deleted_at", null);

    const dynamicRoutes: MetadataRoute.Sitemap = (orgs ?? []).map((o) => ({
        url: `${baseUrl}/${o.org_type === "etang" ? "lieux" : "magasins"}/${
            o.slug
        }`,
        lastModified: new Date(o.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }));

    return [...staticRoutes, ...dynamicRoutes];
}