// =============================================================================
// Layout : (marketing)/marketplace/*
// =============================================================================
// Espace public marketplace (browse + détail listing). Cadre commun, pas de
// header partagé : chaque page enfant gère son propre titre.
// =============================================================================

export default function MarketplacePublicLayout({
                                                    children,
                                                }: {
    children: React.ReactNode;
}) {
    return (
        <div className="bg-background min-h-screen pt-16">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-8 lg:py-12">
                {children}
            </div>
        </div>
    );
}