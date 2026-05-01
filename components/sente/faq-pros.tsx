const FAQ = [
    {
        q: "Y a-t-il un engagement minimum ?",
        a: "Non. Tous nos abonnements sont mensuels et résiliables à tout moment depuis votre dashboard.",
    },
    {
        q: "Comment fonctionnent les paiements en ligne pour les étangs ?",
        a: "Vous créez un compte Stripe Connect Express en 5 minutes (KYC simplifié). Les paiements de vos pêcheurs arrivent directement sur votre IBAN, Sente prélève 3 % au passage. Aucune avance, aucune réconciliation à faire.",
    },
    {
        q: "Et les commissions e-commerce pour les magasins ?",
        a: "5 % en Starter (gratuit), 2,5 % en Pro, 1 % en Boutique+. Snapshot pris au moment de la vente : si vous changez de plan, les ventes passées ne bougent pas.",
    },
    {
        q: "Puis-je gérer mon étang à plusieurs ?",
        a: "Oui. Le plan Dashboard CRM inclut le multi-utilisateurs : invitez votre conjoint·e, votre garde-pêche, votre comptable. Chacun a son rôle (owner, admin, staff).",
    },
    {
        q: "Vous prenez quoi sur la vitrine gratuite ?",
        a: "Rien. La présence vitrine, les posts, les événements, les commentaires : 0 €, à vie. C'est notre façon de remplir la plateforme et de servir la communauté.",
    },
    {
        q: "Et la France ?",
        a: "Sente est ouvert aux étangs et magasins français dès aujourd'hui. Notre focus initial est la Wallonie pour la communauté carpe, mais l'infrastructure est multi-pays dès le jour 1.",
    },
];

export function FaqPros() {
    return (
        <section className="bg-secondary/40 py-24 sm:py-32 border-t border-border">
            <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Questions fréquentes
                </p>
                <h2 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight">
                    Avant de vous lancer.
                </h2>

                <div className="mt-12 divide-y divide-border border-y border-border">
                    {FAQ.map((item) => (
                        <details
                            key={item.q}
                            className="group py-6 cursor-pointer"
                        >
                            <summary className="flex items-center justify-between gap-4 list-none">
                <span className="font-display text-lg leading-snug">
                  {item.q}
                </span>
                                <span className="shrink-0 text-2xl text-accent group-open:rotate-45 transition-transform leading-none">
                  +
                </span>
                            </summary>
                            <p className="mt-4 text-muted-foreground leading-relaxed text-sm sm:text-base">
                                {item.a}
                            </p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}