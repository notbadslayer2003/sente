/**
 * Génère une URL de tracking publique selon le transporteur.
 * Retourne null si le transporteur n'est pas reconnu (champ libre "autre" inclus).
 */
export function buildTrackingUrl(
    carrier: string,
    trackingNumber: string
): string | null {
    if (!trackingNumber || trackingNumber.trim().length === 0) return null;

    const tn = encodeURIComponent(trackingNumber.trim());

    switch (carrier.toLowerCase()) {
        case "bpost":
            return `https://track.bpost.cloud/btr/web/#/search?itemCode=${tn}&lang=fr`;
        case "dpd":
            return `https://www.dpd.com/be/fr/recevoir/suivi-de-colis/?parcelNumber=${tn}`;
        case "gls":
            return `https://gls-group.com/track/${tn}`;
        case "ups":
            return `https://www.ups.com/track?tracknum=${tn}`;
        case "fedex":
            return `https://www.fedex.com/fedextrack/?trknbr=${tn}`;
        case "dhl":
            return `https://www.dhl.com/be-fr/home/suivi.html?tracking-id=${tn}`;
        case "colissimo":
            return `https://www.laposte.fr/outils/suivre-vos-envois?code=${tn}`;
        case "mondial_relay":
            return `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${tn}`;
        default:
            return null;
    }
}

export const TRACKING_CARRIERS: Array<{ value: string; label: string }> = [
    { value: "bpost", label: "Bpost" },
    { value: "dpd", label: "DPD" },
    { value: "gls", label: "GLS" },
    { value: "ups", label: "UPS" },
    { value: "fedex", label: "FedEx" },
    { value: "dhl", label: "DHL" },
    { value: "colissimo", label: "Colissimo / La Poste" },
    { value: "mondial_relay", label: "Mondial Relay" },
    { value: "autre", label: "Autre" },
];

export function carrierLabel(carrier: string | null): string {
    if (!carrier) return "—";
    const found = TRACKING_CARRIERS.find((c) => c.value === carrier.toLowerCase());
    return found?.label ?? carrier;
}