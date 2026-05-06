type Args = {
    customerName: string;
    orderId: string;
    magasinName: string;
    magasinAddress: string | null;
    magasinCity: string | null;
};

export function buildOrderReadyForPickupEmail(args: Args): {
    text: string;
    html: string;
} {
    const orderShort = args.orderId.slice(0, 8).toUpperCase();
    const fullAddress = [args.magasinAddress, args.magasinCity]
        .filter(Boolean)
        .join(", ");

    const text = `Bonjour ${args.customerName},

Bonne nouvelle : ta commande #${orderShort} chez ${args.magasinName} est prête à être retirée.

ADRESSE
${args.magasinName}
${fullAddress || "(adresse non renseignée — contacte le magasin)"}

Pense à présenter ton numéro de commande #${orderShort} ou ton email lors du retrait.

À bientôt,
— L'équipe Sente`;

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f3ee;color:#1a1a1a">
    <table style="width:100%;max-width:600px;margin:0 auto;padding:32px 24px">
        <tr><td>
            <p style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8c5e3c;margin:0 0 12px">
                Prête à retirer
            </p>
            <h1 style="font-size:32px;line-height:1.1;margin:0 0 24px;font-weight:600">
                Ta commande t'attend.
            </h1>
            <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
                ${escapeHtml(args.customerName)}, ta commande chez <strong>${escapeHtml(args.magasinName)}</strong>
                est préparée et prête à être retirée.
            </p>

            <div style="background:#f9f6ef;padding:20px;margin:24px 0;border-left:3px solid #8c5e3c">
                <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6b6b6b;margin:0 0 8px">
                    Adresse
                </p>
                <p style="margin:0;font-size:15px;line-height:1.5">
                    <strong>${escapeHtml(args.magasinName)}</strong><br>
                    ${fullAddress ? escapeHtml(fullAddress) : "(adresse non renseignée — contacte le magasin)"}
                </p>
            </div>

            <p style="margin:24px 0;font-size:14px;line-height:1.6">
                Pense à présenter ton numéro de commande
                <strong style="font-family:monospace">#${orderShort}</strong>
                ou ton email lors du retrait.
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

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}