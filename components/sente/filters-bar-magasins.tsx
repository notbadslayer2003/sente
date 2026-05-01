"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PaysLabel, ProvinceLabel, type Pays, type Province } from "@/lib/schemas/lieu";
import { SpecialiteLabel, type Specialite } from "@/lib/schemas/magasin";

const SPECIALITES: Specialite[] = [
    "general",
    "carpe",
    "carnassier",
    "mouche",
    "peche-blanc",
    "peche-mer",
];

const PAYS_LIST: Pays[] = ["BE", "FR"];

const PROVINCES: Province[] = [
    "hainaut",
    "liege",
    "namur",
    "luxembourg",
    "brabant-wallon",
];

export function FiltersBarMagasins() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const setParam = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === null || value === "") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`);
        });
    };

    const reset = () => {
        startTransition(() => {
            router.push(pathname);
        });
    };

    const currentPays = searchParams.get("pays") ?? "";
    const currentSpecialite = searchParams.get("specialite") ?? "";
    const currentProvince = searchParams.get("province") ?? "";
    const currentPartenaire = searchParams.get("partenaire") === "1";

    const hasFilters =
        currentPays || currentSpecialite || currentProvince || currentPartenaire;

    return (
        <div className="border-y border-border bg-secondary/30">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-6">
                <div className="flex flex-wrap items-center gap-4">
                    <Select
                        label="Pays"
                        value={currentPays}
                        onChange={(v) => setParam("pays", v)}
                        disabled={isPending}
                        options={[
                            { value: "", label: "Tous" },
                            ...PAYS_LIST.map((p) => ({ value: p, label: PaysLabel[p] })),
                        ]}
                    />
                    <Select
                        label="Province"
                        value={currentProvince}
                        onChange={(v) => setParam("province", v)}
                        disabled={isPending}
                        options={[
                            { value: "", label: "Toutes" },
                            ...PROVINCES.map((p) => ({
                                value: p,
                                label: ProvinceLabel[p],
                            })),
                        ]}
                    />
                    <Select
                        label="Spécialité"
                        value={currentSpecialite}
                        onChange={(v) => setParam("specialite", v)}
                        disabled={isPending}
                        options={[
                            { value: "", label: "Toutes" },
                            ...SPECIALITES.map((s) => ({
                                value: s,
                                label: SpecialiteLabel[s],
                            })),
                        ]}
                    />
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={currentPartenaire}
                            onChange={(e) =>
                                setParam("partenaire", e.target.checked ? "1" : null)
                            }
                            disabled={isPending}
                            className="accent-[var(--accent)]"
                        />
                        <span className="uppercase tracking-wide text-xs">
              Partenaires uniquement
            </span>
                    </label>

                    {hasFilters && (
                        <button
                            onClick={reset}
                            disabled={isPending}
                            className="ml-auto text-xs uppercase tracking-wide text-muted-foreground hover:text-accent transition-colors border-b border-muted-foreground/40 pb-0.5 hover:border-accent"
                        >
                            Réinitialiser
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function Select({
                    label,
                    value,
                    onChange,
                    options,
                    disabled,
                }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors disabled:opacity-50 cursor-pointer"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </div>
    );
}