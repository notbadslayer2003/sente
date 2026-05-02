import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptInvitationClient } from "@/components/sente/accept-invitation-client";

type Params = Promise<{ token: string }>;

export default async function AcceptInvitationPage({
                                                       params,
                                                   }: {
    params: Params;
}) {
    const { token } = await params;

    if (!token || token.length !== 64) {
        return <InvitationError message="Lien d'invitation invalide." />;
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Si pas connecté, redirige vers signup pré-rempli avec le token en next
    if (!user) {
        const next = encodeURIComponent(`/invitations/${token}`);
        return (
            <section className="bg-background min-h-screen pt-32 pb-16">
                <div className="mx-auto max-w-md px-6 text-center space-y-6">
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                        Invitation Sente
                    </p>
                    <h1 className="font-display-soft text-4xl tracking-tight leading-[0.95]">
                        Connecte-toi pour accepter.
                    </h1>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Pour rejoindre l&apos;organisation, connecte-toi (ou crée un compte)
                        avec l&apos;adresse email où tu as reçu l&apos;invitation.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center pt-4">
                        <Link
                            href={`/login?next=${next}`}
                            className="bg-accent text-accent-foreground hover:bg-accent/90 transition-colors px-6 py-3 text-sm uppercase tracking-wide"
                        >
                            Me connecter
                        </Link>
                        <Link
                            href={`/signup?role=pecheur&next=${next}`}
                            className="border border-foreground hover:bg-foreground hover:text-background transition-colors px-6 py-3 text-sm uppercase tracking-wide"
                        >
                            Créer un compte
                        </Link>
                    </div>
                </div>
            </section>
        );
    }

    return <AcceptInvitationClient token={token} />;
}

function InvitationError({ message }: { message: string }) {
    return (
        <section className="bg-background min-h-screen pt-32 pb-16">
            <div className="mx-auto max-w-md px-6 text-center space-y-6">
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Invitation
                </p>
                <h1 className="font-display-soft text-4xl tracking-tight leading-[0.95]">
                    Lien invalide.
                </h1>
                <p className="text-sm text-muted-foreground">{message}</p>
                <Link
                    href="/"
                    className="inline-block text-sm uppercase tracking-wide border-b border-foreground pb-1 hover:text-accent hover:border-accent transition-colors"
                >
                    ← Retour à l&apos;accueil
                </Link>
            </div>
        </section>
    );
}