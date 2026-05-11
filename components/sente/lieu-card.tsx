import Link from "next/link";
import Image from "next/image";
import {Badge} from "@/components/ui/badge";
import {ProvinceLabel, type Lieu} from "@/lib/schemas/lieu";

export function LieuCard({lieu}: Readonly<{ lieu: Lieu }>) {
    return (
        <Link
            href={`/lieux/${lieu.slug}`}
            className="group block overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {lieu.coverImageUrl ? (
                    <Image
                        src={lieu.coverImageUrl}
                        alt={lieu.nom}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Photo à venir
                        </span>
                    </div>
                )}
                {lieu.reglement.noKill && (
                    <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground border-0">
                        No-kill
                    </Badge>
                )}
                {lieu.reservable && (
                    <Badge className="absolute top-3 right-3 bg-accent text-accent-foreground border-0">
                        Réservable
                    </Badge>
                )}
            </div>
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl tracking-tight leading-tight">
                        {lieu.nom}
                    </h3>
                    {lieu.noteMoyenne && (
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
              ★ {lieu.noteMoyenne.toFixed(1)}
            </span>
                    )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    {lieu.commune} · {ProvinceLabel[lieu.province]} · {lieu.superficieHa} ha
                </p>
                <div className="mt-4 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                        {lieu.especes.slice(0, 2).map((e) => (
                            <Badge key={e} variant="secondary" className="capitalize">
                                {e}
                            </Badge>
                        ))}
                    </div>
                    <span className="text-sm font-medium">
            dès <span className="text-primary">{lieu.tarif.jour}€</span> / jour
          </span>
                </div>
            </div>
        </Link>
    );
}