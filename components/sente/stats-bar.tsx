export function StatsBar({
                             nbLieux,
                             nbMagasinsPartenaires,
                         }: {
    nbLieux: number;
    nbMagasinsPartenaires: number;
}) {
    return (
        <section className="bg-foreground text-background py-12 sm:py-16">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4 items-center">
                    <Stat value={nbLieux} label="Étangs vérifiés" />
                    <Stat value={nbMagasinsPartenaires} label="Magasins partenaires" />
                    <Stat value="BE · FR" label="Wallonie & France" isText />
                </div>
            </div>
        </section>
    );
}

function Stat({
                  value,
                  label,
                  isText = false,
              }: {
    value: number | string;
    label: string;
    isText?: boolean;
}) {
    return (
        <div className="flex flex-col sm:items-center text-left sm:text-center gap-1">
      <span
          className={`font-display-soft tracking-tight ${
              isText ? "text-3xl sm:text-4xl italic font-light" : "text-4xl sm:text-5xl"
          }`}
      >
        {value}
      </span>
            <span className="text-xs uppercase tracking-[0.2em] text-background/60">
        {label}
      </span>
        </div>
    );
}