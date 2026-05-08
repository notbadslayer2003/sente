type MarketplaceShippedNotificationData = {
    buyerFullName: string;
    sellerFullName: string;
    listingTitle: string;
    trackingNumber: string;
    trackingUrl: string;
    relayPointId: string | null;
    orderUrl: string;
};

export function buildMarketplaceShippedNotificationEmail(
    data: MarketplaceShippedNotificationData
) {
    const text = `Bonjour ${data.buyerFullName},

Bonne nouvelle : ${data.sellerFullName} vient d'expédier ton achat "${data.listingTitle}".

Numéro de suivi Mondial Relay : ${data.trackingNumber}
${data.relayPointId ? `Point relais de retrait : ${data.relayPointId}\n` : ""}
Suivre ton colis :
${data.trackingUrl}

Tu seras notifié dès que le colis sera disponible au point relais.

Voir la commande :
${data.orderUrl}

— L'équipe Sente`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f4f0;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e4df;">
          <tr>
            <td style="padding:40px 40px 20px 40px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#666;">Sente — Marketplace</p>
              <h1 style="margin:16px 0 0 0;font-family:Georgia,serif;font-size:32px;font-weight:400;line-height:1.1;color:#1a1a1a;">
                Ton colis est en route.
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#444;">
                Bonjour ${data.buyerFullName},<br>
                <strong>${data.sellerFullName}</strong> vient d'expédier ton achat <strong>${data.listingTitle}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e4df;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e4df;">
                    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Numéro de suivi</p>
                    <p style="margin:0;font-size:18px;color:#1a1a1a;font-family:monospace;">${data.trackingNumber}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;${data.relayPointId ? "border-bottom:1px solid #e5e4df;" : ""}">
                    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Transporteur</p>
                    <p style="margin:0;font-size:15px;color:#1a1a1a;">Mondial Relay</p>
                  </td>
                </tr>
                ${
        data.relayPointId
            ? `<tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Point relais de retrait</p>
                    <p style="margin:0;font-size:15px;color:#1a1a1a;font-family:monospace;">${data.relayPointId}</p>
                  </td>
                </tr>`
            : ""
    }
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 16px 40px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#444;">
                Tu seras notifié par Mondial Relay dès que le colis sera disponible au point relais.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <a href="${data.trackingUrl}" style="display:inline-block;background:#4a6741;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;margin-right:8px;">
                Suivre le colis
              </a>
              <a href="${data.orderUrl}" style="display:inline-block;border:1px solid #4a6741;color:#4a6741;text-decoration:none;padding:13px 27px;font-size:13px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;">
                Voir la commande
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0 0;font-size:11px;color:#999;text-align:center;">
          Sente — la plateforme de la communauté pêche
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return { text, html };
}