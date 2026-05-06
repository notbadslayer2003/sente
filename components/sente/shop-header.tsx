import Image from "next/image";

type Props = {
    orgName: string;
    orgSlug: string;
    description: string | null;
    city: string | null;
    coverUrl: string | null;
};

export function ShopHeader({
                               orgName,
                               description,
                               city,
                               coverUrl,
                           }: Props) {
    return (
        <header className="mb-10 space-y-4">
            <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Boutique
                </p>
                <h1 className="mt-2 font-display text-4xl sm:text-5xl tracking-tight leading-[0.95]">
                    {orgName}
                </h1>
                {city && (
                    <p className="mt-2 text-sm text-muted-foreground">{city}</p>
                )}
            </div>

            {description && (
                <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
                    {description}
                </p>
            )}
        </header>
    );
}