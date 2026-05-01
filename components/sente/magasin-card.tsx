import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ProvinceLabel } from "@/lib/schemas/lieu";
import { SpecialiteLabel, type Magasin } from "@/lib/schemas/magasin";

export function MagasinCard({ magasin }: { magasin: Magasin }) {
    return (
        <Link
            href={`/magasins/${magasin.slug}`}
            className="group block overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <Image
                    src={magasin.photos[0]}
                    alt={magasin.nom}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {magasin.partenaire && (
                    <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground border-0">
                        Partenaire
                    </Badge>
                )}
            </div>
            <div className="p-5 space-y-3">
                <div>
                    <h3 className="font-display text-xl tracking-tight leading-tight">
                        {magasin.nom}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {magasin.ville} · {ProvinceLabel[magasin.province]}
                    </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {magasin.specialites.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary">
                            {SpecialiteLabel[s]}
                        </Badge>
                    ))}
                </div>
            </div>
        </Link>
    );
}