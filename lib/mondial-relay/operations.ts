import { callMondialRelay, MondialRelayError } from "./client";
import {
    RelayPointSlotSchema,
    SearchRelayPointsResultSchema,
} from "./types";
import { callMondialRelayV2, getV2Context, MondialRelayV2Error } from "./client-v2";
import { ShipmentCreationResponseSchema } from "./types-v2";

// =============================================================================
// Operations MR typées
// =============================================================================

export type RelayPoint = {
    id: string; // ex: "020530"
    name: string;
    address: string;
    postalCode: string;
    city: string;
    country: string;
};

/**
 * Recherche jusqu'à 10 points relais MR autour d'une ville/code postal.
 *
 * Note WSI2 vs autres versions : pas de filtre par lat/lng/rayon ici. La
 * recherche est par ville + CP. MR renvoie un nombre fixe de slots PR01..PR10,
 * dont certains peuvent être vides — on filtre ces vides à la sortie.
 *
 * @param input.country "BE" ou "FR"
 * @param input.postalCode code postal
 * @param input.city ville (peut être vide string si on cherche par CP seul)
 * @param input.weight poids en grammes — sert au filtrage côté MR (certains
 *                     relais ont des limites de gabarit). Optionnel.
 */
export async function searchRelayPoints(input: {
    country: "BE" | "FR";
    postalCode: string;
    city?: string;
    weight?: number;
}): Promise<RelayPoint[]> {
    const merchant = process.env.MR_MERCHANT;
    if (!merchant) {
        throw new Error("MR_MERCHANT manquant dans l'environnement");
    }

    // Ordre CRITIQUE pour la signature WSI2_RecherchePointRelais :
    // Enseigne, Pays, Ville, CP, Taille, Poids, Action
    const params = [
        ["Enseigne", merchant],
        ["Pays", input.country],
        ["Ville", input.city ?? ""],
        ["CP", input.postalCode],
        ["Taille", ""], // optionnel — gabarit colis (S/M/L) ; vide = pas de filtre
        ["Poids", input.weight ? String(input.weight) : ""],
        ["Action", ""], // optionnel — type de service ; vide = standard
    ] as const;

    const result = await callMondialRelay(
        "WSI2_RecherchePointRelais",
        params,
        SearchRelayPointsResultSchema
    );

    // Si STAT présent et non zéro → erreur métier MR
    if (result.STAT && result.STAT !== "0") {
        throw new MondialRelayError(
            `Recherche relais MR failed (STAT=${result.STAT})`,
            result.STAT,
            "WSI2_RecherchePointRelais"
        );
    }

    // Extraction : itère sur PR01..PR10 et filtre les vides (Num absent ou vide)
    const relays: RelayPoint[] = [];
    const resultRecord = result as Record<string, unknown>;

    for (let i = 1; i <= 10; i++) {
        const key = `PR${i.toString().padStart(2, "0")}`; // PR01, PR02, ...
        const slot = resultRecord[key];
        if (!slot) continue;

        const parsed = RelayPointSlotSchema.safeParse(slot);
        if (!parsed.success) continue;
        if (!parsed.data.Num || parsed.data.Num.trim() === "") continue;

        relays.push({
            id: parsed.data.Num,
            name: parsed.data.LgAdr1 ?? "",
            address: [parsed.data.LgAdr2, parsed.data.LgAdr3, parsed.data.LgAdr4]
                .filter((s) => s && s.trim() !== "")
                .join(", "),
            postalCode: parsed.data.CP ?? "",
            city: parsed.data.Ville ?? "",
            country: parsed.data.Pays ?? "",
        });
    }

    return relays;
}

// =============================================================================
// V2 — création expédition + récupération étiquette PDF
// =============================================================================

export type ShipmentParty = {
    name: string;       // → AddressAdd1 (raison sociale ou nom complet)
    line1?: string;     // → AddressAdd2 (complément, optionnel)
    line2: string;      // → Streetname (rue + n°)
    line3?: string;     // → AddressAdd3 (locality, optionnel)
    city: string;
    postalCode: string;
    country: "BE" | "FR" | "LU" | "NL" | "ES" | "PT" | "DE" | "AT" | "IT" | "PL";
    phone: string;
    email: string;
};

export type CreateShipmentLabelInput = {
    /** Identifiant interne, max 15 chars uppercase, imprimé sur l'étiquette. */
    dossier: string;
    /** "REL" = dépôt en relais, "CCC" = livreur passe chez seller. */
    modeCol?: "REL" | "CCC";
    /** "24R" = livraison en relais, "HOM" = livraison à domicile. */
    modeLiv?: "24R" | "24L" | "HOM" | "LD1" | "LDS";
    sender: ShipmentParty;
    recipient: ShipmentParty;
    weightGrams: number;
    /** Pour 24R/24L : pays + ID du relais où le buyer récupère. */
    relay: { country: "BE" | "FR"; id: string };
    /** Pour ModeCol="REL" : pays + ID du relais où le seller dépose. Optionnel. */
    collectRelay?: { country: "BE" | "FR"; id: string };
    description?: string;
    /** Format PDF retourné. Default A4. */
    labelFormat?: "A4" | "A5" | "10x15";
};

/**
 * Construit un sous-arbre <Address> compatible V2.
 * MR V2 attend Streetname, HouseNo, AddressAdd1..3 séparés.
 * On simplifie : on met tout dans Streetname et AddressAdd1 fait office de "nom".
 */
function buildAddressXml(party: ShipmentParty) {
    return {
        Title: "",
        Firstname: "",
        Lastname: "",
        Streetname: party.line2,
        HouseNo: "",
        CountryCode: party.country,
        PostCode: party.postalCode,
        City: party.city,
        AddressAdd1: party.name,
        AddressAdd2: party.line1 ?? "",
        AddressAdd3: party.line3 ?? "",
        PhoneNo: party.phone,
        MobileNo: "",
        Email: party.email,
    };
}

/**
 * Crée une expédition Mondial Relay via API V2 et retourne l'URL de l'étiquette PDF.
 * @throws MondialRelayV2Error si une erreur métier MR est retournée
 */
export async function createShipmentLabel(
    input: CreateShipmentLabelInput
): Promise<{ expeditionNumber: string; labelUrl: string }> {
    const ctx = getV2Context();

    const deliveryMode = input.modeLiv ?? "24R";
    const collectMode = input.modeCol ?? "CCC";

    // Format Location pour 24R/24L : "<pays>-<id_relais>"
    const deliveryLocation =
        deliveryMode === "24R" || deliveryMode === "24L"
            ? `${input.relay.country}-${input.relay.id}`
            : "";

    // Si ModeCol=REL, location = pays-id du relais collecte
    const collectLocation =
        collectMode === "REL" && input.collectRelay
            ? `${input.collectRelay.country}-${input.collectRelay.id}`
            : "";

    const payload = {
        Context: ctx,
        OutputOptions: {
            OutputFormat: input.labelFormat ?? "A4",
            OutputType: "PdfUrl" as const,
        },
        ShipmentsList: {
            Shipment: {
                OrderNo: input.dossier,
                CustomerNo: "",
                ParcelCount: "1",
                DeliveryMode: { "@_Mode": deliveryMode, "@_Location": deliveryLocation },
                CollectionMode: { "@_Mode": collectMode, "@_Location": collectLocation },
                Parcels: {
                    Parcel: {
                        Content: input.description ?? "",
                        Weight: { "@_Value": String(input.weightGrams), "@_Unit": "gr" },
                        Length: { "@_Value": "1", "@_Unit": "cm" },
                        Width: { "@_Value": "1", "@_Unit": "cm" },
                        Depth: { "@_Value": "1", "@_Unit": "cm" },
                    },
                },
                DeliveryInstruction: "",
                Sender: { Address: buildAddressXml(input.sender) },
                Recipient: { Address: buildAddressXml(input.recipient) },
            },
        },
    };

    const result = await callMondialRelayV2(payload, ShipmentCreationResponseSchema);

    // Vérif erreurs métier dans StatusList
    const statusList = result.StatusList;
    if (statusList?.Status) {
        const statuses = Array.isArray(statusList.Status) ? statusList.Status : [statusList.Status];
        const errors = statuses.filter(
            (s) => s["@_Level"] === "Error" || s["@_Level"] === "CriticalError"
        );
        if (errors.length > 0) {
            const first = errors[0];
            throw new MondialRelayV2Error(
                `MR V2 erreur métier : code=${first["@_Code"]} level=${first["@_Level"]} msg=${first["@_Message"]}`,
                first["@_Code"] ?? null,
                first["@_Level"] ?? null
            );
        }
    }

    // Extraction du shipment + label
    const shipment = result.ShipmentsList?.Shipment;
    const firstShipment = Array.isArray(shipment) ? shipment[0] : shipment;
    if (!firstShipment) {
        throw new MondialRelayV2Error("MR V2 réponse sans Shipment", null, null);
    }

    const expeditionNumber = firstShipment["@_ShipmentNumber"];
    if (!expeditionNumber) {
        throw new MondialRelayV2Error("MR V2 réponse sans ShipmentNumber", null, null);
    }

    const label = firstShipment.LabelList?.Label;
    const firstLabel = Array.isArray(label) ? label[0] : label;
    const output = firstLabel?.Output;
    const labelUrl = typeof output === "string" ? output : null;

    if (!labelUrl) {
        throw new MondialRelayV2Error("MR V2 réponse sans Output URL", null, null);
    }

    return { expeditionNumber, labelUrl };
}