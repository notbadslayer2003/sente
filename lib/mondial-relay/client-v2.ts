import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { z } from "zod";

// =============================================================================
// Mondial Relay V2 — client REST/XML
// =============================================================================
// Différences vs V1 SOAP :
//   - Pas de signature MD5 : auth via Login/Password dans le body XML
//   - Pas d'envelope SOAP, juste un body XML "ShipmentCreationRequest"
//   - Endpoint dédié connect-api-sandbox/connect-api
//
// Référence : web-service-dual-carrier-v-271.pdf
// =============================================================================

export class MondialRelayV2Error extends Error {
    constructor(
        message: string,
        public readonly statusCode: string | null,
        public readonly statusLevel: string | null
    ) {
        super(message);
        this.name = "MondialRelayV2Error";
    }
}

type V2Context = {
    Login: string;
    Password: string;
    CustomerId: string;
    Culture: string;
    VersionAPI: "1.0";
};

function getV2Context(): V2Context {
    const login = process.env.MR_V2_LOGIN;
    const password = process.env.MR_V2_PASSWORD;
    const customerId = process.env.MR_V2_CUSTOMER_ID;
    const culture = process.env.MR_V2_CULTURE ?? "fr-FR";

    if (!login || !password || !customerId) {
        throw new Error(
            "MR V2 credentials missing (MR_V2_LOGIN, MR_V2_PASSWORD, MR_V2_CUSTOMER_ID)"
        );
    }
    return { Login: login, Password: password, CustomerId: customerId, Culture: culture, VersionAPI: "1.0" };
}

/**
 * Construit le XML d'une requête ShipmentCreationRequest.
 * Le body XML object est traduit en chaîne XML par XMLBuilder.
 *
 * Note : les attributs XML (ex: <Parcel Mode="24R">) sont préfixés par
 * `@_` côté input — convention fast-xml-parser.
 */
function buildShipmentRequestXml(input: Record<string, unknown>): string {
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        format: false,
        suppressEmptyNode: false,
    });

    const root = {
        "?xml": { "@_version": "1.0", "@_encoding": "utf-8" },
        ShipmentCreationRequest: {
            "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@_xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
            "@_xmlns": "http://www.example.org/Request",
            ...input,
        },
    };

    return builder.build(root);
}

/**
 * Envoie un ShipmentCreationRequest et parse la réponse.
 *
 * @param payload Sous-arbre XML : { Context, OutputOptions, ShipmentsList }
 * @param responseSchema Schéma zod du sous-arbre ShipmentCreationResponse
 */
export async function callMondialRelayV2<T>(
    payload: {
        Context: V2Context;
        OutputOptions: { OutputFormat: "A4" | "A5" | "10x15"; OutputType: "PdfUrl" | "ZplCode" | "IplCode" };
        ShipmentsList: { Shipment: unknown };
    },
    responseSchema: z.ZodType<T>
): Promise<T> {
    const apiUrl = process.env.MR_V2_API_URL;
    if (!apiUrl) {
        throw new Error("MR_V2_API_URL manquante dans l'environnement");
    }

    const xmlBody = buildShipmentRequestXml(payload);

    const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
            Accept: "application/xml",
            "Content-Type": "text/xml",
        },
        body: xmlBody,
    });

    const responseText = await res.text();

    if (!res.ok) {
        throw new MondialRelayV2Error(
            `MR V2 HTTP ${res.status} ${res.statusText} :: ${responseText.slice(0, 500)}`,
            null,
            null
        );
    }

    // Parse XML response
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        removeNSPrefix: true,
        parseTagValue: false,
    });

    let parsed: unknown;
    try {
        parsed = parser.parse(responseText);
    } catch (err) {
        throw new MondialRelayV2Error(
            `MR V2 XML parse failed: ${(err as Error).message}`,
            null,
            null
        );
    }

    const root = (parsed as Record<string, unknown>)?.ShipmentCreationResponse;
    if (!root) {
        throw new MondialRelayV2Error(
            `MR V2 réponse sans ShipmentCreationResponse : ${responseText.slice(0, 300)}`,
            null,
            null
        );
    }

    const validated = responseSchema.safeParse(root);
    if (!validated.success) {
        console.error(
            "MR V2 response structure mismatch:",
            JSON.stringify(root, null, 2)
        );
        throw new MondialRelayV2Error(
            `MR V2 zod validation failed: ${validated.error.message}`,
            null,
            null
        );
    }
    return validated.data;
}

export { getV2Context };