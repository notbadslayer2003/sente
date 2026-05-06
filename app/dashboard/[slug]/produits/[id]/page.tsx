import { notFound } from "next/navigation";
import Link from "next/link";
import { getDashboardContext } from "@/lib/dal/dashboard";
import { getProductForDashboard } from "@/lib/dal/products";
import { getCategoriesFlat } from "@/lib/dal/product-categories";
import {
    canPublishProduct,
    canAddProductPhoto,
    canAddVariantToProduct,
} from "@/lib/dal/feature-gate";
import { ProductEditor } from "@/components/sente/product-editor";

type Params = Promise<{ slug: string; id: string }>;

export default async function ProductEditPage({
                                                  params,
                                              }: {
    params: Params;
}) {
    const { slug, id } = await params;

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

    const product = await getProductForDashboard(id);
    if (!product) notFound();
    if (product.organization_id !== ctx.org.id) notFound();

    const categories = await getCategoriesFlat();

    // Feature gating : on calcule les flags côté serveur et on les passe au
    // composant client. Defense in depth : les server actions revérifient.
    const [publishGate, photoGate, variantGate] = await Promise.all([
        canPublishProduct(ctx.org.id),
        canAddProductPhoto({ orgId: ctx.org.id, productId: id }),
        canAddVariantToProduct({ orgId: ctx.org.id, productId: id }),
    ]);

    return (
        <div className="space-y-8">
            {/* Breadcrumb */}
            <nav className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <Link
                    href={`/dashboard/${slug}/produits`}
                    className="hover:text-accent transition-colors"
                >
                    Produits
                </Link>
                <span className="mx-2">›</span>
                <span className="text-foreground">{product.name}</span>
            </nav>

            <ProductEditor
                slug={slug}
                product={product}
                categories={categories}
                gates={{
                    canPublish: publishGate.ok,
                    publishReason: publishGate.ok ? null : publishGate.reason,
                    canAddPhoto: photoGate.ok,
                    addPhotoReason: photoGate.ok ? null : photoGate.reason,
                    canUseVariants: variantGate.ok,
                    variantsReason: variantGate.ok ? null : variantGate.reason,
                }}
            />
        </div>
    );
}