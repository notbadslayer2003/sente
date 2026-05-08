"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
    searchRelayPoints,
    type RelayPoint,
} from "@/lib/mondial-relay/operations";

// =============================================================================
// Server Actions : Mondial Relay
// =============================================================================
// Wrappers server-side qui exposent l'API MR au client. Auth required pour
// éviter l'abuse anonyme (les buyers anonymes n'ont pas à interroger MR).
// =============================================================================

type ActionResult<T = void> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

const searchSchema = z.object({
    country: z.enum(["BE", "FR"]),
    postalCode: z.string().min(4).max(10),
});

/**
 * Recherche jusqu'à 10 points relais MR autour d'un code postal.
 * Le client utilise ça depuis le composant RelayPointPicker pendant le checkout.
 */
export async function searchMondialRelayRelays(input: {
    country: "BE" | "FR";
    postalCode: string;
}): Promise<ActionResult<RelayPoint[]>> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return {
            ok: false,
            error: { code: "UNAUTHENTICATED", message: "Non connecté" },
        };
    }

    const parsed = searchSchema.safeParse(input);
    if (!parsed.success) {
        return {
            ok: false,
            error: { code: "INVALID_INPUT", message: parsed.error.message },
        };
    }

    try {
        const relays = await searchRelayPoints(parsed.data);
        return { ok: true, data: relays };
    } catch (err) {
        console.error("searchMondialRelayRelays failed:", err);
        return {
            ok: false,
            error: {
                code: "MR_FAILED",
                message:
                    err instanceof Error
                        ? err.message
                        : "Erreur lors de la recherche Mondial Relay",
            },
        };
    }
}