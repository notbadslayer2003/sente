import { LegalLayout, LegalSection } from "@/components/sente/legal-layout";

export const metadata = { title: "Mentions légales — Sente" };

export default function MentionsLegalesPage() {
    return (
        <LegalLayout title="Mentions légales" lastUpdated="1ᵉʳ mai 2026">
            <LegalSection title="Éditeur du site">
                <p>
                    Le site <strong>sente.app</strong> (ci-après « Sente ») est édité par
                    TwoStack, société sise à Mons, Belgique.
                </p>
                <p>Contact : contact@sente.app</p>
            </LegalSection>

            <LegalSection title="Hébergement">
                <p>
                    Le site est hébergé par Vercel Inc., 440 N Barranca Avenue #4133,
                    Covina, CA 91723, USA.
                </p>
                <p>
                    L&apos;infrastructure backend (base de données, authentification,
                    stockage) est fournie par Supabase Inc., 970 Toa Payoh North #07-04,
                    Singapore 318992.
                </p>
            </LegalSection>

            <LegalSection title="Propriété intellectuelle">
                <p>
                    L&apos;ensemble des contenus, textes, images, logos et éléments
                    graphiques présents sur Sente sont, sauf mention contraire, la
                    propriété exclusive de TwoStack ou utilisés avec l&apos;autorisation de
                    leurs ayants droit.
                </p>
                <p>
                    Toute reproduction, représentation, modification ou exploitation, à
                    titre commercial ou non, sans accord préalable écrit, est interdite.
                </p>
            </LegalSection>

            <LegalSection title="Responsabilité">
                <p>
                    Sente s&apos;efforce d&apos;assurer l&apos;exactitude des informations
                    publiées. Toutefois, les fiches d&apos;étangs et de magasins reposent
                    en partie sur les déclarations des partenaires et utilisateurs. Sente
                    ne peut être tenu responsable des erreurs, omissions ou indisponibilités.
                </p>
            </LegalSection>

            <LegalSection title="Litiges">
                <p>
                    Tout litige relatif à l&apos;utilisation du site est soumis au droit
                    belge. Les juridictions de Mons sont seules compétentes.
                </p>
            </LegalSection>
        </LegalLayout>
    );
}