import Link from "next/link";

type SearchParams = Promise<{ session_id?: string }>;

export default async function PaymentSuccessPage({
                                                     searchParams,
                                                 }: {
    searchParams: SearchParams;
}) {
    const sp = await searchParams;
    const hasSession = !!sp.session_id;

    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-md px-6 text-center space-y-8">
                <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-primary">
                        Paiement reçu
                    </p>
                    <h1 className="mt-3 font-display-soft text-5xl tracking-tight leading-[0.95]">
                        Merci.
                    </h1>
                </div>

                <div className="border border-primary/30 bg-primary/5 p-6 text-left">
                    <p className="text-sm leading-relaxed">
                        Ton paiement a été traité avec succès. L'étang reçoit la
                        notification et te confirmera l'inscription. Tu vas recevoir
                        un email de confirmation dans les minutes qui suivent.
                    </p>
                </div>

                {hasSession && (
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Réf : {sp.session_id?.slice(-12)}
                    </p>
                )}

                <Link
                    href="/"
                    className="inline-block text-sm uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                >
                    Retour à l'accueil
                </Link>
            </div>
        </section>
    );
}