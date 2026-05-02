import Link from "next/link";

export const metadata = { title: "Erreur d'authentification — Sente" };

export default function AuthErrorPage() {
    return (
        <section className="bg-background min-h-screen pt-32 pb-16 flex items-center">
            <div className="mx-auto max-w-md px-6 text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Erreur
                </p>
                <h1 className="mt-3 font-display-soft text-4xl tracking-tight">
                    Lien invalide ou expiré.
                </h1>
                <p className="mt-6 text-muted-foreground">
                    Le lien que tu as suivi n&apos;est plus valide. Demande un nouveau
                    lien depuis la page de connexion.
                </p>
                <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                    <Link
                        href="/login"
                        className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3 text-sm uppercase tracking-wide"
                    >
                        Se connecter
                    </Link>
                </div>
            </div>
        </section>
    );
}