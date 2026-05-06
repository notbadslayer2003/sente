type Args = {
    customerName: string;
    orderId: string;
    magasinName: string;
    trackingCarrier: string;
    trackingNumber: string;
    trackingUrl: string | null;
};

export function buildOrderShippedEmail(args: Args): {
    text: string;
    html: string;
} {
    const orderShort = args.orderId.slice(0, 8).toUpperCase();
    const carrierLabel = formatCarrier(args.trackingCarrier);

    const text = `Bonjour ${args.customerName},

Ta commande #${orderShort} chez ${args.magasinName} vient d'être expédiée.

SUIVI
Transporteur : ${carrierLabel}
Numéro : ${args.trackingNumber}
${args.trackingUrl ? `Lien : ${args.trackingUrl}` : ""}

À bientôt,
— L'équipe Sente`;

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f3ee;color:#1a1a1a">
    <table style="width:100%;max-width:600px;margin:0 auto;padding:32px 24px">
        <tr><td>
            <p style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8c5e3c;margin:0 0 12px">
                Expédiée
            </p>
            <h1 style="font-size:32px;line-height:1.1;margin:0 0 24px;font-weight:600">
                C'est parti.
            </h1>
            <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
                ${escapeHtml(args.customerName)}, ta commande chez <strong>${escapeHtml(args.magasinName)}</strong>
                vient d'être confiée au transporteur.
            </p>

            <div style="background:#f9f6ef;padding:20px;margin:24px 0;border-left:3px solid #8c5e3c">
                <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6b6b6b;margin:0 0 8px">
                    Suivi
                </p>
                <p style="margin:0;font-size:14px;line-height:1.7">
                    <strong>Transporteur :</strong> ${escapeHtml(carrierLabel)}<br>
                    <strong>Numéro :</strong>
                    <span style="font-family:monospace">${escapeHtml(args.trackingNumber)}</span>
                </p>
                ${
        args.trackingUrl
            ? `<p style="margin:16px 0 0">
                            <a href="${escapeHtml(args.trackingUrl)}"
                               style="display:inline-block;background:#8c5e3c;color:#fff;padding:10px 20px;text-decoration:none;font-size:13px;letter-spacing:0.05em;text-transform:uppercase">
                                Suivre mon colis →
                            </a>
                          </p>`
            : ""
    }
            </div>

            <p style="margin:24px 0;font-size:14px;line-height:1.6;color:#6b6b6b">
                Numéro de commande : <strong style="font-family:monospace">#${orderShort}</strong>
            </p>

            <hr style="border:none;border-top:1px solid #ddd;margin:40px 0 16px">
            <p style="color:#6b6b6b;font-size:12px;margin:0">
                Sente · L'annuaire pêche & chasse en Wallonie et France.
            </p>
        </td></tr>
    </table>
</body></html>`;

    return { text, html };
}

function formatCarrier(carrier: string): string {
    const map: Record<string, string> = {
        bpost: "Bpost",
        dpd: "DPD",
        gls: "GLS",
        ups: "UPS",
        fedex: "FedEx",
        dhl: "DHL",
        colissimo: "Colissimo / La Poste",
        mondial_relay: "Mondial Relay",
        autre: "Autre",
    };
    return map[carrier.toLowerCase()] ?? carrier;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}