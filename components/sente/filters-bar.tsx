"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const ESPECES = [
    { v: "all", l: "Toutes espèces" },
    { v: "carpe", l: "Carpe" },
    { v: "carnassier", l: "Carnassier" },
    { v: "salmonide", l: "Salmonidé" },
    { v: "blanc", l: "Poisson blanc" },
    { v: "silure", l: "Silure" },
];

const PROVINCES = [
    { v: "all", l: "Toute la Wallonie" },
    { v: "hainaut", l: "Hainaut" },
    { v: "liege", l: "Liège" },
    { v: "namur", l: "Namur" },
    { v: "luxembourg", l: "Luxembourg" },
    { v: "brabant-wallon", l: "Brabant wallon" },
];

export function FiltersBar() {
    const router = useRouter();
    const params = useSearchParams();
    const [pending, startTransition] = useTransition();

    function update(key: string, value: string) {
        const next = new URLSearchParams(params);
        if (value === "all") next.delete(key);
        else next.set(key, value);
        startTransition(() => {
            router.push(`/lieux?${next.toString()}`, { scroll: false });
        });
    }

    return (
        <div className="flex flex-col sm:flex-row gap-3">
            <Select
                value={params.get("espece") ?? "all"}
                onValueChange={(v) => update("espece", v)}
            >
                <SelectTrigger className="sm:w-56" disabled={pending}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {ESPECES.map((e) => (
                        <SelectItem key={e.v} value={e.v}>
                            {e.l}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select
                value={params.get("province") ?? "all"}
                onValueChange={(v) => update("province", v)}
            >
                <SelectTrigger className="sm:w-56" disabled={pending}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {PROVINCES.map((p) => (
                        <SelectItem key={p.v} value={p.v}>
                            {p.l}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}