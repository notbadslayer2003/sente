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

export default async function HomePage() {
    const [lieuxFeatured, lieuxAll, magasinsPartenaires, magasinsAll] =
        await Promise.all([
            getLieux().then((all) => all.slice(0, 3)),
            getLieux(),
            getMagasins({ partenaireOnly: true }),
            getMagasins(),
        ]);

    return (
        <>
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