type Data = {
    fullName: string;
    eventTitle: string;
    orgName: string;
    refundAmountEur: number;
    reason: string;
};

export function buildEventRefundEmail(data: Data) {
    const text = `Bonjour ${data.fullName},

${data.orgName} t'a remboursé ${data.refundAmountEur.toFixed(2)} € pour l'événement "${data.eventTitle}".

Motif : ${data.reason}

Le montant sera recrédité sur ta carte sous 5 à 10 jours ouvrés.

— L'équipe Sente`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f4f0;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4f0;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e4df;">
        <tr><td style="padding:40px 40px 20px 40px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#666;">Sente</p>
          <h1 style="margin:16px 0 0 0;font-family:Georgia,serif;font-size:32px;font-weight:400;line-height:1.1;">
            Remboursement de ${data.refundAmountEur.toFixed(2)} €
          </h1>
        </td></tr>
        <tr><td style="padding:0 40px 20px 40px;">
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#444;">
            Bonjour <strong>${escapeHtml(data.fullName)}</strong>,
          </p>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#444;">
            <strong>${escapeHtml(data.orgName)}</strong> a procédé au remboursement de ton inscription à <strong>${escapeHtml(data.eventTitle)}</strong>.
          </p>
          <table style="margin:24px 0;width:100%;border-collapse:collapse;border:1px solid #e5e4df;">
            <tr><td style="padding:14px 20px;background:#f5f4f0;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.15em;">Montant remboursé</td></tr>
            <tr><td style="padding:14px 20px;border-bottom:1px solid #e5e4df;font-family:Georgia,serif;font-size:32px;color:#1a1a1a;">${data.refundAmountEur.toFixed(2)} €</td></tr>
            <tr><td style="padding:14px 20px;font-size:14px;"><strong>Motif</strong> · ${escapeHtml(data.reason)}</td></tr>
          </table>
          <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#666;">
            Le montant sera recrédité sur ta carte sous 5 à 10 jours ouvrés selon ta banque.
          </p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0 0;font-size:11px;color:#999;text-align:center;">
        Sente — la plateforme de la communauté pêche
      </p>
    </td></tr>
  </table>
</body></html>`;

    return { text, html };
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}