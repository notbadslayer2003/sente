import Link from "next/link";
import { ESPECE_LABEL } from "@/lib/constants/especes";

export function PostMetaRow({
                                espece,
                                weight_kg,
                                matos,
                                mentions,
                            }: Readonly<{
    espece: string | null;
    weight_kg: number | null;
    matos: string | null;
    mentions: Array<{ id: string; slug: string; name: string; org_type: string }>;
}>) {
    const hasMeta = !!espece || !!weight_kg || !!matos;
    const hasMentions = mentions.length > 0;
    if (!hasMeta && !hasMentions) return null;

    return (
        <div className="space-y-3">
            {hasMeta && (
                <div className="flex flex-wrap items-center gap-2">
                    {espece && (
                        <span className="px-2.5 py-1 text-xs bg-secondary border border-border">
                            {(ESPECE_LABEL as Record<string, string>)[espece] ?? espece}
                        </span>
                    )}
                    {weight_kg && (
                        <span className="px-2.5 py-1 text-xs bg-secondary border border-border tabular-nums">
                          {weight_kg.toFixed(2)} kg
                        </span>
                    )}
                    {matos && (
                        <span className="px-2.5 py-1 text-xs bg-secondary border border-border">
                          {matos}
                        </span>
                    )}
                </div>
            )}

            {hasMentions && (
                <p className="text-xs text-muted-foreground">
                    À{" "}
                    {mentions.map((m, i) => (
                        <span key={m.id}>
              <Link
                  href={
                      m.org_type === "etang"
                          ? `/lieux/${m.slug}`
                          : `/magasins/${m.slug}`
                  }
                  className="text-accent hover:text-accent/80 transition-colors"
              >
                {m.name}
              </Link>
                            {i < mentions.length - 1 && ", "}
            </span>
                    ))}
                </p>
            )}
        </div>
    );
}