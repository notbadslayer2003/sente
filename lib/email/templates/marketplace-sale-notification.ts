type MarketplaceSaleNotificationData = {
    sellerFullName: string;
    buyerFullName: string;
    listingTitle: string;
    itemPriceEur: number;
    payoutEur: number;
    shippingCarrierLabel: string;
    relayPointId: string | null;
    orderUrl: string;
};

export function buildMarketplaceSaleNotificationEmail(
    data: MarketplaceSaleNotificationData
) {
    const relayLine = data.relayPointId
        ? `Point relais Mondial Relay : ${data.relayPointId}`
        : null;

    const text = `Bonjour ${data.sellerFullName},

Bonne nouvelle : ton annonce "${data.listingTitle}" vient d'être achetée par ${data.buyerFullName}.

Récapitulatif :
- Prix de vente : ${data.itemPriceEur.toFixed(2)} €
- Tu recevras : ${data.payoutEur.toFixed(2)} € (après commission Sente et frais)
- Mode d'expédition : ${data.shippingCarrierLabel}${relayLine ? `\n- ${relayLine}` : ""}

Prochaine étape : prépare le colis et expédie-le dans les 7 jours. Tu peux générer ton étiquette directement depuis la commande sur Sente.

Voir la commande :
${data.orderUrl}

Le paiement est sécurisé en escrow chez Sente. Il sera transféré sur ton compte 48h après confirmation de livraison par l'acheteur.

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
                Tu as une vente à expédier.
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#444;">
                Bonjour ${data.sellerFullName},<br>
                Ton annonce <strong>${data.listingTitle}</strong> vient d'être achetée par <strong>${data.buyerFullName}</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e4df;">
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e4df;">
                    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Prix de vente</p>
                    <p style="margin:0;font-size:18px;color:#1a1a1a;">${data.itemPriceEur.toFixed(2)} €</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;border-bottom:1px solid #e5e4df;">
                    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Tu recevras</p>
                    <p style="margin:0;font-size:18px;color:#4a6741;font-weight:500;">${data.payoutEur.toFixed(2)} €</p>
                    <p style="margin:4px 0 0 0;font-size:12px;color:#888;">après commission Sente et frais Stripe</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;${data.relayPointId ? "border-bottom:1px solid #e5e4df;" : ""}">
                    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Expédition</p>
                    <p style="margin:0;font-size:15px;color:#1a1a1a;">${data.shippingCarrierLabel}</p>
                  </td>
                </tr>
                ${
        data.relayPointId
            ? `<tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Point relais</p>
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
                <strong>Prochaine étape</strong> : prépare le colis et expédie-le sous 7 jours. Tu pourras générer ton étiquette d'expédition directement depuis la commande.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <a href="${data.orderUrl}" style="display:inline-block;background:#4a6741;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;">
                Voir la commande
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px 40px;border-top:1px solid #e5e4df;padding-top:24px;">
              <p style="margin:0;font-size:13px;color:#888;line-height:1.5;">
                Le paiement est sécurisé en escrow chez Sente. Il sera transféré sur ton compte 48h après confirmation de livraison par l'acheteur.
              </p>
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