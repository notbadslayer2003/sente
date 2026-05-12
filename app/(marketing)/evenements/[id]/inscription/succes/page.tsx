import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getEventDetail } from "@/lib/dal/events";
import {notFound} from "next/navigation";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ registration?: string }>;

export default async function SuccessPage({
                                              params,
                                          }: {
    params: Params;
    searchParams: SearchParams;
}) {
    if (process.env.VERCEL_ENV === "production") notFound();

    const { id } = await params;
    const event = await getEventDetail(id);

    return (
        <section className="bg-background min-h-screen pt-24 pb-20">
            <div className="mx-auto max-w-xl px-6 sm:px-8 text-center">
                <CheckCircle2 className="mx-auto w-16 h-16 text-primary mb-6" strokeWidth={1.5} />
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Inscription confirmée
                </p>
                <h1 className="mt-3 font-display-soft text-4xl tracking-tight">
                    À bientôt !
                </h1>
                <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
                    Ton inscription{event ? ` à "${event.title}"` : ""} a bien été enregistrée.
                    Tu recevras un email de confirmation dans les prochaines minutes.
                </p>
                <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
                    <Link
                        href={`/evenements/${id}`}
                        className="text-xs uppercase tracking-wide bg-accent text-accent-foreground px-5 py-2.5 hover:bg-accent/90 transition-colors font-medium"
                    >
                        Retour à l&apos;événement
                    </Link>
                    <Link
                        href="/profil/inscriptions"
                        className="text-xs uppercase tracking-wide border-b border-foreground pb-0.5 hover:text-accent hover:border-accent transition-colors"
                    >
                        Mes inscriptions →
                    </Link>
                </div>
            </div>
        </section>
    );
}