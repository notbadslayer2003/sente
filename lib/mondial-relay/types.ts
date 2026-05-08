import { z } from "zod";

// =============================================================================
// Schemas zod pour les opérations MR utilisées dans Sente
// =============================================================================

// -----------------------------------------------------------------------------
// WSI2_RecherchePointRelais — recherche points relais
// -----------------------------------------------------------------------------

// Un slot PR (PR01..PR10) — peut être présent et vide (Num="") si pas de
// résultat à cet index, ou rempli avec les détails du relais.
export const RelayPointSlotSchema = z.object({
    Num: z.string().optional(),
    LgAdr1: z.string().optional(),
    LgAdr2: z.string().optional(),
    LgAdr3: z.string().optional(),
    LgAdr4: z.string().optional(),
    CP: z.string().optional(),
    Ville: z.string().optional(),
    Pays: z.string().optional(),
}).passthrough();

// La réponse contient potentiellement PR01..PR10. On utilise passthrough
// pour les capturer dynamiquement, et on extrait/normalise dans operations.ts.
// STAT n'apparaît pas dans le sample WSDL succès, mais MR peut le retourner
// en cas d'erreur — on le déclare optional pour être defensive.
export const SearchRelayPointsResultSchema = z.object({
    STAT: z.string().optional(),
}).passthrough();

export type RelayPointSlot = z.infer<typeof RelayPointSlotSchema>;

// -----------------------------------------------------------------------------
// WSI2_CreationEtiquette — création expédition + étiquette PDF
// -----------------------------------------------------------------------------

export const CreateShipmentLabelResultSchema = z.object({
    STAT: z.string().optional(),
    ExpeditionNum: z.string().optional(),
    URL_Etiquette: z.string().optional(),
}).passthrough();