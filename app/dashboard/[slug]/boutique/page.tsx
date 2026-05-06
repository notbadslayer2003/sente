import { getDashboardContext } from "@/lib/dal/dashboard";
import { getShopSettingsOrDefaults } from "@/lib/dal/shop-settings";
import { ShopSettingsForm } from "@/components/sente/shop-settings-form";

type Params = Promise<{ slug: string }>;

export default async function BoutiqueParametresPage({
                                                         params,
                                                     }: {
    params: Params;
}) {
    const { slug } = await params;
    const ctx = await getDashboardContext(slug);

    if (ctx.org.org_type !== "magasin") {
        return (
            <div className="border border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">
                    Cette section est réservée aux magasins.
                </p>
            </div>
        );
    }

    const settings = await getShopSettingsOrDefaults(ctx.org.id);
    const canEdit = ctx.role === "owner" || ctx.role === "admin";

    return (
        <div className="space-y-8 max-w-3xl">
            <header>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Configuration
                </p>
                <h1 className="mt-2 font-display text-3xl tracking-tight">
                    Paramètres boutique
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Définis les modes de récupération que tu proposes à tes clients et
                    les frais associés.
                </p>
            </header>

            {!canEdit && (
                <div className="border border-border bg-secondary/20 p-4">
                    <p className="text-xs text-muted-foreground">
                        Lecture seule. Seul un propriétaire ou administrateur peut modifier
                        ces paramètres.
                    </p>
                </div>
            )}

            <ShopSettingsForm
                organizationId={ctx.org.id}
                initialSettings={settings}
                canEdit={canEdit}
            />
        </div>
    );
}