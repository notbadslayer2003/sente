import { LegalLayout, LegalSection } from "@/components/sente/legal-layout";

export const metadata = { title: "Conditions générales d'utilisation — Sente" };

export default function CguPage() {
    return (
        <LegalLayout
            title="Conditions générales d'utilisation"
            lastUpdated="1ᵉʳ mai 2026"
        >
            <LegalSection title="Objet">
                <p>
                    Les présentes Conditions Générales d&apos;Utilisation (« CGU »)
                    régissent l&apos;accès et l&apos;usage de la plateforme Sente, qui met
                    en relation pêcheurs, étangs et magasins spécialisés en Wallonie et en
                    France.
                </p>
                <p>
                    L&apos;utilisation du site implique l&apos;acceptation pleine et
                    entière des présentes CGU.
                </p>
            </LegalSection>

            <LegalSection title="Création de compte">
                <p>L&apos;utilisateur peut créer un compte en tant que :</p>
                <ul>
                    <li>Pêcheur particulier (gratuit)</li>
                    <li>Gestionnaire d&apos;étang (présence gratuite, dashboard CRM en option)</li>
                    <li>Magasin spécialisé (présence gratuite, e-commerce en option)</li>
                </ul>
                <p>
                    L&apos;utilisateur s&apos;engage à fournir des informations exactes et à
                    en maintenir la mise à jour.
                </p>
            </LegalSection>

            <LegalSection title="Contenus utilisateurs">
                <p>
                    Les utilisateurs peuvent publier des posts, commentaires, photos et
                    avis. Ils restent propriétaires de leurs contenus mais accordent à
                    Sente une licence d&apos;utilisation gratuite, non exclusive, pour
                    l&apos;affichage sur la plateforme.
                </p>
                <p>Sont strictement interdits :</p>
                <ul>
                    <li>Les contenus illicites, diffamatoires, haineux ou injurieux</li>
                    <li>La désinformation et les fausses fiches</li>
                    <li>La promotion de pratiques interdites par la loi (braconnage, pêche illégale)</li>
                    <li>Le spam et la publicité non sollicitée</li>
                </ul>
                <p>
                    Sente se réserve le droit de modérer, masquer ou supprimer tout
                    contenu non conforme et, en cas de manquement répété, de suspendre ou
                    fermer le compte concerné.
                </p>
            </LegalSection>

            <LegalSection title="Abonnements professionnels">
                <p>
                    Les abonnements payants (Dashboard CRM étang, plans e-commerce
                    magasins) sont mensuels et résiliables à tout moment depuis le
                    dashboard. Le détail des prix figure sur la page{" "}
                    <a href="/partenaires">Partenaires</a>.
                </p>
                <p>
                    Les paiements sont traités par Stripe Inc. Les données bancaires ne
                    transitent jamais par les serveurs de Sente.
                </p>
            </LegalSection>

            <LegalSection title="Commissions sur transactions">
                <p>
                    Sente prélève une commission sur les paiements effectués via la
                    plateforme :
                </p>
                <ul>
                    <li>3 % sur les abonnements pêcheurs encaissés par les étangs</li>
                    <li>5 %, 2,5 % ou 1 % sur les ventes e-commerce magasin selon le plan choisi</li>
                </ul>
                <p>
                    Le taux applicable est figé au moment de la transaction. Un changement
                    de plan ne modifie pas les commissions des transactions passées.
                </p>
            </LegalSection>

            <LegalSection title="Résiliation">
                <p>
                    L&apos;utilisateur peut supprimer son compte à tout moment. Les données
                    personnelles sont conservées 30 jours après la suppression, puis
                    effacées définitivement, sous réserve des obligations comptables et
                    légales (factures, conformité fiscale).
                </p>
            </LegalSection>

            <LegalSection title="Évolution des CGU">
                <p>
                    Sente peut faire évoluer les présentes CGU. Toute modification
                    substantielle est notifiée par email aux utilisateurs concernés au
                    moins 30 jours avant son entrée en vigueur.
                </p>
            </LegalSection>
        </LegalLayout>
    );
}