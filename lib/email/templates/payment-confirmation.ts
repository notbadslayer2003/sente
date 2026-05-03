type PaymentConfirmationData = {
    pecheurName: string;
    etangName: string;
    amountEur: number;
    saisonYear: number;
    startDate: string;
    endDate: string;
};

export function buildPaymentConfirmationEmail(data: PaymentConfirmationData) {
    const text = `Bonjour ${data.pecheurName},

Ton paiement de ${data.amountEur.toFixed(2)} € pour ${data.etangName} a bien été reçu.

Récapitulatif :
- Étang : ${data.etangName}
- Saison : ${data.saisonYear}
- Période : ${data.startDate} au ${data.endDate}
- Montant : ${data.amountEur.toFixed(2)} €

Bonne pêche.

— L'équipe Sente`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f4f0;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e4df;">
        <tr><td style="padding:40px 40px 20px 40px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#4a6741;">Paiement reçu</p>
          <h1 style="margin:16px 0 0 0;font-family:Georgia,serif;font-size:32px;font-weight:400;line-height:1.1;">
            Bonne pêche, ${data.pecheurName}.
          </h1>
        </td></tr>
        <tr><td style="padding:0 40px;">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#444;">
            Ton paiement pour <strong>${data.etangName}</strong> a bien été reçu. L'étang est notifié.
          </p>
          <table style="margin:24px 0;width:100%;border-collapse:collapse;border:1px solid #e5e4df;">
            <tr><td style="padding:14px 20px;background:#f5f4f0;border-bottom:1px solid #e5e4df;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.15em;">Récapitulatif</td></tr>
            <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e4df;font-size:14px;"><strong>Étang</strong> · ${data.etangName}</td></tr>
            <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e4df;font-size:14px;"><strong>Saison</strong> · ${data.saisonYear}</td></tr>
            <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e4df;font-size:14px;"><strong>Période</strong> · du ${data.startDate} au ${data.endDate}</td></tr>
            <tr><td style="padding:14px 20px;font-size:14px;"><strong>Montant payé</strong> · ${data.amountEur.toFixed(2)} €</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 40px 40px;border-top:1px solid #e5e4df;padding-top:24px;">
          <p style="margin:0;font-size:13px;color:#888;line-height:1.5;">
            Tu peux conserver cet email comme preuve de paiement.
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