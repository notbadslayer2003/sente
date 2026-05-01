import { getLieux } from "@/lib/data/lieux";
import { getMagasins } from "@/lib/data/magasins";
import { Hero } from "@/components/sente/hero";
import { APropos } from "@/components/sente/a-propos";
import { LieuxAlaUne } from "@/components/sente/lieux-a-la-une";
import { MagasinsPartenaires } from "@/components/sente/magasins-partenaires";
import { CarteWallonie } from "@/components/sente/carte-wallonie";
import { PourLesExploitants } from "@/components/sente/pour-les-exploitants";
import { Newsletter } from "@/components/sente/newsletter";

export default async function HomePage() {
    const [
        lieuxPeche,
        lieuxChasse,
        lieuxAll,
        magasinsPechePartenaires,
        magasinsChassePartenaires,
    ] = await Promise.all([
        getLieux({ type: "peche" }).then((all) => all.slice(0, 3)),
        getLieux({ type: "chasse" }).then((all) => all.slice(0, 3)),
        getLieux(),
        getMagasins({ type: "peche", partenaireOnly: true }),
        getMagasins({ type: "chasse", partenaireOnly: true }),
    ]);

    return (
        <>
            <Hero />
            <APropos />
            <LieuxAlaUne peche={lieuxPeche} chasse={lieuxChasse} />
            <MagasinsPartenaires
                peche={magasinsPechePartenaires}
                chasse={magasinsChassePartenaires}
            />
            <CarteWallonie lieux={lieuxAll} />
            <PourLesExploitants />
            <Newsletter />
        </>
    );
}