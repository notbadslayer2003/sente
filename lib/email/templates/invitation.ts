type InvitationEmailData = {
    inviterName: string;
    orgName: string;
    role: "admin" | "staff";
    acceptUrl: string;
    expiresInDays: number;
};

export function buildInvitationEmail(data: InvitationEmailData) {
    const roleLabel = data.role === "admin" ? "administrateur" : "membre de l'équipe";

    const text = `Bonjour,

${data.inviterName} t'invite à rejoindre ${data.orgName} sur Sente en tant que ${roleLabel}.

Pour accepter l'invitation, clique sur ce lien :
${data.acceptUrl}

Ce lien est valide ${data.expiresInDays} jours.

Si tu n'attendais pas cette invitation, ignore simplement cet email.

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
              <p style="margin:0;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#666;">Sente</p>
              <h1 style="margin:16px 0 0 0;font-family:Georgia,serif;font-size:32px;font-weight:400;line-height:1.1;color:#1a1a1a;">
                Tu es invité·e à rejoindre ${data.orgName}.
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#444;">
                <strong>${data.inviterName}</strong> t'invite à rejoindre <strong>${data.orgName}</strong> sur Sente en tant que ${roleLabel}.
              </p>
              <p style="margin:0 0 32px 0;font-size:15px;line-height:1.6;color:#444;">
                Si tu n'as pas encore de compte Sente, tu en créeras un en cliquant sur le lien ci-dessous (avec l'email où tu as reçu cette invitation).
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <a href="${data.acceptUrl}" style="display:inline-block;background:#4a6741;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;">
                Accepter l'invitation
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px 40px;border-top:1px solid #e5e4df;padding-top:24px;">
              <p style="margin:0 0 8px 0;font-size:13px;color:#888;line-height:1.5;">
                Ce lien expire dans ${data.expiresInDays} jours.
              </p>
              <p style="margin:0;font-size:13px;color:#888;line-height:1.5;">
                Si tu n'attendais pas cette invitation, ignore simplement cet email.
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