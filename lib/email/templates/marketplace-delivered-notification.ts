type MarketplaceDeliveredNotificationData = {
    listingTitle: string;
    orderUrl: string;
};

export function buildMarketplaceDeliveredNotificationEmail(
    data: MarketplaceDeliveredNotificationData
) {
    const text = `Bonne nouvelle,

L'acheteur de "${data.listingTitle}" vient de confirmer la réception du colis.

Le paiement sera transféré sur ton compte Stripe sous 48h. Tu recevras un autre mail dès que le virement est effectué.

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
                Livraison confirmée.
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#444;">
                L'acheteur de <strong>${data.listingTitle}</strong> vient de confirmer la réception du colis.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <div style="border:1px solid #e5e4df;padding:20px;background:#fafaf7;">
                <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#888;">Prochaine étape</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#1a1a1a;">
                  Le paiement sera transféré sur ton compte Stripe <strong>sous 48h</strong>.
                </p>
                <p style="margin:8px 0 0 0;font-size:13px;color:#666;">
                  Tu recevras un mail dès que le virement est effectué.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <a href="${data.orderUrl}" style="display:inline-block;background:#4a6741;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;">
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