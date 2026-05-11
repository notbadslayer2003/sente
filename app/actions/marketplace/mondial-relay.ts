"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { searchServicePoints } from "@/lib/sendcloud/operations";
import type { RelayPoint } from "@/lib/mondial-relay/operations";

// =============================================================================
// Recherche points relais Mondial Relay (via Sendcloud)
// =============================================================================
// Nom conservé pour ne pas casser l'import côté composant. Derrière, on appelle
// Sendcloud filtré sur carrier=mondial_relay.
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const searchSchema = z.object({
    country: z.enum(["BE", "FR"]),
    postalCode: z.string().min(4).max(10),
});

export async function searchMondialRelayRelays(input: {
    country: "BE" | "FR";
    postalCode: string;
}): Promise<ActionResult<RelayPoint[]>> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, error: { code: "UNAUTHENTICATED", message: "Non connecté" } };
    }

    const parsed = searchSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: { code: "INVALID_INPUT", message: parsed.error.message } };
    }

    try {
        const points = await searchServicePoints({
            country: parsed.data.country,
            postalCode: parsed.data.postalCode,
            carrier: "mondial_relay",
        });
        // ServicePoint ⊃ RelayPoint (champs en plus ignorés par l'UI)
        return { ok: true, data: points };
    } catch (err) {
        console.error("searchMondialRelayRelays failed:", err);
        return {
            ok: false,
            error: {
                code: "MR_FAILED",
                message: err instanceof Error ? err.message : "Erreur Sendcloud",
            },
        };
    }
}