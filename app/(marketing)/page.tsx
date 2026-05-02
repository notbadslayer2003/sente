import { getLieux } from "@/lib/data/lieux";
import { getMagasins } from "@/lib/data/magasins";
import { Hero } from "@/components/sente/hero";
import { APropos } from "@/components/sente/a-propos";
import { CommentCaMarche } from "@/components/sente/comment-ca-marche";
import { StatsBar } from "@/components/sente/stats-bar";
import { LieuxAlaUne } from "@/components/sente/lieux-a-la-une";
import { MagasinsPartenaires } from "@/components/sente/magasins-partenaires";
import { CarteWallonie } from "@/components/sente/carte-wallonie";
import { PourLesExploitants } from "@/components/sente/pour-les-exploitants";
import { Newsletter } from "@/components/sente/newsletter";

type SearchParams = Promise<{ account_deleted?: string }>;

export default async function HomePage({
                                           searchParams,
                                       }: Readonly<{
    searchParams: SearchParams;
}>) {
    const params = await searchParams;
    const accountDeleted = params.account_deleted === "1";
    const [lieuxFeatured, lieuxAll, magasinsPartenaires, magasinsAll] =
        await Promise.all([
            getLieux().then((all) => all.slice(0, 3)),
            getLieux(),
            getMagasins({ partenaireOnly: true }),
            getMagasins(),
        ]);

    return (
        <>
            {accountDeleted && (
                <div className="bg-primary/10 border-b border-primary/30 pt-20 pb-4 sm:pt-24">
                    <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 text-sm text-foreground">
                        Ton compte a été supprimé. Tes données seront purgées
                        définitivement dans 30 jours.
                    </div>
                </div>
            )}
            <Hero />
            <APropos />
            <CommentCaMarche />
            <LieuxAlaUne lieux={lieuxFeatured} />
            <StatsBar
                nbLieux={lieuxAll.length}
                nbMagasinsPartenaires={magasinsAll.filter((m) => m.partenaire).length}
            />
            <MagasinsPartenaires magasins={magasinsPartenaires} />
            <CarteWallonie lieux={lieuxAll} />
            <PourLesExploitants />
            <Newsletter />
        </>
    );
}