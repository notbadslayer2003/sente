import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

// =============================================================================
// Mondial Relay — client SOAP minimal
// =============================================================================
// Pas besoin d'une lib SOAP complète : MR accepte des POST XML simples.
// On encapsule :
//   1. Construction du body XML dans le bon ordre des params
//   2. Signature MD5 (concat values + private key, uppercase)
//   3. POST + parse XML retour
//   4. Validation zod du résultat
//
// Référence : https://www.mondialrelay.fr/solutionspro/documentation-de-nos-outils/
// =============================================================================

export class MondialRelayError extends Error {
    constructor(
        message: string,
        public readonly stat: string | null,
        public readonly operation: string
    ) {
        super(message);
        this.name = "MondialRelayError";
    }
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function computeSignature(
    orderedValues: ReadonlyArray<string>,
    privateKey: string
): string {
    // Pattern MR : concat brut des values + private key, MD5, upper.
    // PAS d'inclusion des noms de paramètres.
    const concatenated = orderedValues.join("") + privateKey;
    return crypto.createHash("md5").update(concatenated).digest("hex").toUpperCase();
}

/**
 * Appelle une opération MR en SOAP.
 *
 * @param operation Nom de l'opération MR (ex: "WSI4_PointRelais_Recherche")
 * @param params Paramètres dans l'ORDRE EXACT de la signature.
 *               Tableau de [key, value] — les valeurs vides doivent être
 *               présentes (string vide), pas omises, sinon la signature
 *               sera invalide.
 * @param responseSchema Schéma zod du résultat attendu (sans l'envelope SOAP)
 */
export async function callMondialRelay<T>(
    operation: string,
    params: ReadonlyArray<readonly [string, string]>,
    responseSchema: z.ZodType<T>
): Promise<T> {
    const privateKey = process.env.MR_PRIVATE_KEY;
    const apiUrl = process.env.MR_API_URL ?? "https://api.mondialrelay.com/Web_Services.asmx";
    if (!privateKey) {
        throw new Error("MR_PRIVATE_KEY manquante dans l'environnement");
    }

    // 1. Signature
    const orderedValues = params.map(([, v]) => v);
    const security = computeSignature(orderedValues, privateKey);

    // 2. Construction du body SOAP
    const paramsXml = params
        .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
        .join("\n      ");

    const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${operation} xmlns="http://www.mondialrelay.fr/webservice/">
      ${paramsXml}
      <Security>${security}</Security>
    </${operation}>
  </soap:Body>
</soap:Envelope>`;


    const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            // SOAP 1.1 spec : la value du SOAPAction header est entre guillemets
            SOAPAction: `"http://www.mondialrelay.fr/webservice/${operation}"`,
        },
        body,
    });

    const responseText = await res.text();

    if (!res.ok) {
        throw new MondialRelayError(
            `MR ${operation} HTTP ${res.status} ${res.statusText} :: ${responseText.slice(0, 500)}`,
            null,
            operation
        );
    }

    const xml = responseText;

    // 4. Parse XML — on désactive les attributs (MR n'en utilise pas en réponse)
    //    et on retire les namespace prefixes pour des chemins propres.
    const parser = new XMLParser({
        ignoreAttributes: true,
        removeNSPrefix: true,
        parseTagValue: false, // Garde tout en string, on cast nous-mêmes via zod
        // textNodeName: "#text", // par défaut, OK
    });

    let parsed: unknown;
    try {
        parsed = parser.parse(xml);
    } catch (err) {
        throw new MondialRelayError(
            `MR ${operation} XML parse failed: ${(err as Error).message}`,
            null,
            operation
        );
    }

    // 5. Navigation dans l'envelope SOAP : Envelope.Body[OperationResponse][OperationResult]
    const root = (parsed as Record<string, unknown>)?.Envelope as
        | Record<string, unknown>
        | undefined;
    const responseEnv = root?.Body as Record<string, unknown> | undefined;
    const opResponse = responseEnv?.[`${operation}Response`] as
        | Record<string, unknown>
        | undefined;
    const opResult = opResponse?.[`${operation}Result`];

    if (opResult === undefined || opResult === null) {
        throw new MondialRelayError(
            `MR ${operation} : pas de résultat dans la réponse`,
            null,
            operation
        );
    }

    // 6. Validation zod
    const validated = responseSchema.safeParse(opResult);
    if (!validated.success) {
        // Print l'objet brut côté server pour debug — la structure XML SOAP
        // peut varier légèrement selon les opérations.
        console.error(
            `MR ${operation} response structure mismatch:`,
            JSON.stringify(opResult, null, 2)
        );
        throw new MondialRelayError(
            `MR ${operation} response zod validation failed: ${validated.error.message}`,
            null,
            operation
        );
    }
    return validated.data;
}