type PaymentLinkData = {
    pecheurName: string;
    etangName: string;
    amountEur: number;
    saisonYear: number;
    payUrl: string;
    expiresInDays: number;
};

export function buildPaymentLinkEmail(data: PaymentLinkData) {
    const text = `Bonjour ${data.pecheurName},

${data.etangName} t'invite à régler ton abonnement saison ${data.saisonYear}.

Montant : ${data.amountEur.toFixed(2)} €

Pour payer en ligne (carte bancaire), clique sur ce lien :
${data.payUrl}

Lien valide ${data.expiresInDays} jours.

Paiement sécurisé par Stripe. Sente facilite la transaction, l'argent est versé directement à l'étang.

— L'équipe Sente`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f4f0;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e4df;">
        <tr><td style="padding:40px 40px 20px 40px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#666;">Sente</p>
          <h1 style="margin:16px 0 0 0;font-family:Georgia,serif;font-size:32px;font-weight:400;line-height:1.1;">
            Paiement en attente
          </h1>
        </td></tr>
        <tr><td style="padding:0 40px;">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#444;">
            Bonjour <strong>${data.pecheurName}</strong>,
          </p>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#444;">
            <strong>${data.etangName}</strong> t'invite à régler ton abonnement de pêche saison ${data.saisonYear}.
          </p>
          <table style="margin:24px 0;width:100%;border-collapse:collapse;background:#f5f4f0;">
            <tr><td style="padding:16px 20px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.15em;">Montant à régler</td></tr>
            <tr><td style="padding:0 20px 16px 20px;font-family:Georgia,serif;font-size:36px;color:#1a1a1a;">${data.amountEur.toFixed(2)} €</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 32px 40px;">
          <a href="${data.payUrl}" style="display:inline-block;background:#4a6741;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;">
            Payer en ligne
          </a>
        </td></tr>
        <tr><td style="padding:0 40px 40px 40px;border-top:1px solid #e5e4df;padding-top:24px;">
          <p style="margin:0 0 8px 0;font-size:13px;color:#888;line-height:1.5;">
            Lien valide ${data.expiresInDays} jours. Paiement sécurisé par Stripe.
          </p>
          <p style="margin:0;font-size:13px;color:#888;line-height:1.5;">
            Sente facilite la transaction, l'argent est versé directement à l'étang.
          </p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0 0;font-size:11px;color:#999;text-align:center;">
        Sente — la plateforme de la communauté pêche
      </p>
    </td></tr>
  </table>
</body>
</html>`;

    return { text, html };
}