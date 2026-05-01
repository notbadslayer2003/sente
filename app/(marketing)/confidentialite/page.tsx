import { LegalLayout, LegalSection } from "@/components/sente/legal-layout";

export const metadata = { title: "Politique de confidentialité — Sente" };

export default function ConfidentialitePage() {
    return (
        <LegalLayout
            title="Politique de confidentialité"
            lastUpdated="1ᵉʳ mai 2026"
        >
            <LegalSection title="Responsable de traitement">
                <p>
                    TwoStack, éditeur de Sente, est responsable du traitement des données
                    personnelles collectées sur la plateforme, conformément au Règlement
                    Général sur la Protection des Données (RGPD).
                </p>
                <p>Contact : privacy@sente.app</p>
            </LegalSection>

            <LegalSection title="Données collectées">
                <p>Sente collecte les données suivantes :</p>
                <ul>
                    <li>Identité : nom, prénom, email, mot de passe (haché)</li>
                    <li>Profil : photo, ville, pays, préférences pêche</li>
                    <li>Activité : posts, commentaires, follows, likes</li>
                    <li>Étangs / magasins : informations professionnelles, photos, contacts</li>
                    <li>Paiements : ID Stripe (les données bancaires ne sont jamais stockées par Sente)</li>
                    <li>Techniques : adresse IP, user-agent, logs de connexion</li>
                </ul>
            </LegalSection>

            <LegalSection title="Finalités">
                <p>Vos données sont utilisées pour :</p>
                <ul>
                    <li>Fournir le service (annuaire, fil social, messagerie, paiements)</li>
                    <li>Communiquer avec vous (notifications, support, newsletters opt-in)</li>
                    <li>Améliorer le produit (analytics agrégées, anonymisées)</li>
                    <li>Répondre aux obligations légales (comptabilité, fiscalité, DAC7)</li>
                </ul>
            </LegalSection>

            <LegalSection title="Sous-traitants">
                <p>Sente utilise les sous-traitants suivants, conformes RGPD :</p>
                <ul>
                    <li>Supabase (Singapour) — base de données, authentification, stockage</li>
                    <li>Vercel (USA) — hébergement frontend</li>
                    <li>Stripe (Irlande / USA) — paiements</li>
                    <li>Resend (USA) — envoi d&apos;emails transactionnels</li>
                    <li>Sentry (USA) — monitoring d&apos;erreurs</li>
                    <li>PostHog (USA) — analytics produit</li>
                </ul>
                <p>
                    Les transferts hors UE sont encadrés par les Clauses Contractuelles
                    Types de la Commission européenne.
                </p>
            </LegalSection>

            <LegalSection title="Durée de conservation">
                <ul>
                    <li>Compte actif : pendant toute la durée d&apos;utilisation</li>
                    <li>Compte supprimé : 30 jours puis effacement</li>
                    <li>Factures et données comptables : 7 ans (obligation légale)</li>
                    <li>Logs techniques : 12 mois</li>
                </ul>
            </LegalSection>

            <LegalSection title="Vos droits">
                <p>Conformément au RGPD, vous disposez des droits suivants :</p>
                <ul>
                    <li>Accès à vos données</li>
                    <li>Rectification</li>
                    <li>Suppression (droit à l&apos;oubli)</li>
                    <li>Portabilité (export JSON)</li>
                    <li>Opposition au traitement</li>
                    <li>Retrait du consentement</li>
                </ul>
                <p>
                    Pour exercer ces droits, écrivez à{" "}
                    <a href="mailto:privacy@sente.app">privacy@sente.app</a>. Vous pouvez
                    également déposer une réclamation auprès de l&apos;Autorité de
                    Protection des Données (Belgique) ou de la CNIL (France).
                </p>
            </LegalSection>

            <LegalSection title="Sécurité">
                <p>
                    Sente met en œuvre des mesures techniques et organisationnelles
                    raisonnables : chiffrement TLS, hashage des mots de passe, contrôle
                    d&apos;accès Row-Level Security en base, journalisation des accès,
                    audit régulier.
                </p>
            </LegalSection>
        </LegalLayout>
    );
}