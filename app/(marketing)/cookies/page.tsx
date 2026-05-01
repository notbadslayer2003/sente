import { LegalLayout, LegalSection } from "@/components/sente/legal-layout";

export const metadata = { title: "Politique cookies — Sente" };

export default function CookiesPage() {
    return (
        <LegalLayout title="Politique cookies" lastUpdated="1ᵉʳ mai 2026">
            <LegalSection title="Qu'est-ce qu'un cookie ?">
                <p>
                    Un cookie est un petit fichier texte déposé sur votre terminal lors de
                    votre visite. Il permet de reconnaître votre navigateur, de mémoriser
                    vos préférences ou d&apos;analyser l&apos;usage du site.
                </p>
            </LegalSection>

            <LegalSection title="Cookies utilisés par Sente">
                <p>
                    <strong>Cookies strictement nécessaires</strong> — exemptés de
                    consentement. Ils permettent l&apos;authentification, la sécurité, la
                    persistance de la session.
                </p>
                <p>
                    <strong>Cookies de mesure d&apos;audience</strong> — soumis à
                    consentement. Sente utilise PostHog (auto-hébergé EU dès que possible)
                    pour comprendre l&apos;usage du produit. Aucune publicité, aucun
                    tracking cross-site.
                </p>
                <p>
                    <strong>Cookies tiers paiement</strong> — déposés par Stripe lors d&apos;un
                    paiement, strictement nécessaires à la sécurité de la transaction.
                </p>
            </LegalSection>

            <LegalSection title="Gestion de votre consentement">
                <p>
                    Vous pouvez modifier vos préférences à tout moment depuis le bandeau
                    cookies (en bas de page) ou dans les paramètres de votre compte.
                </p>
                <p>
                    Vous pouvez également bloquer les cookies via les paramètres de votre
                    navigateur. Le blocage des cookies strictement nécessaires peut
                    cependant empêcher le bon fonctionnement du site.
                </p>
            </LegalSection>

            <LegalSection title="Durée de vie">
                <ul>
                    <li>Session d&apos;authentification : 30 jours</li>
                    <li>Préférences cookies : 12 mois</li>
                    <li>Mesure d&apos;audience : 13 mois maximum</li>
                </ul>
            </LegalSection>
        </LegalLayout>
    );
}