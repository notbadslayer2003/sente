type Args = {
    customerName: string;
    orderId: string;
    magasinName: string;
    deliveryMethod: "click_collect" | "shipping_standard" | "shipping_local";
    totalEur: number;
    items: Array<{
        name: string;
        variant: string | null;
        quantity: number;
        lineTotalEur: number;
    }>;
};

const DELIVERY_LABELS: Record<Args["deliveryMethod"], string> = {
    click_collect: "Retrait en magasin",
    shipping_standard: "Livraison standard",
    shipping_local: "Livraison locale",
};

const DELIVERY_NEXT_STEPS: Record<Args["deliveryMethod"], string> = {
    click_collect:
        "Tu seras prévenu(e) par email dès que ta commande est prête à être retirée.",
    shipping_standard:
        "Le magasin va préparer ta commande puis l'expédier. Tu recevras un email avec le suivi.",
    shipping_local:
        "Le magasin va préparer ta commande puis te contacter pour la livraison.",
};

export function buildShopOrderConfirmEmail(args: Args): {
    text: string;
    html: string;
} {
    const orderShort = args.orderId.slice(0, 8).toUpperCase();

    const itemsText = args.items
        .map((it) => {
            const variant = it.variant ? ` (${it.variant})` : "";
            return `  • ${it.name}${variant} × ${it.quantity} — ${it.lineTotalEur.toFixed(2)} €`;
        })
        .join("\n");

    const text = `Bonjour ${args.customerName},

Ta commande chez ${args.magasinName} est confirmée.

NUMÉRO DE COMMANDE : #${orderShort}
TOTAL : ${args.totalEur.toFixed(2)} €
MODE DE RÉCUPÉRATION : ${DELIVERY_LABELS[args.deliveryMethod]}

ARTICLES :
${itemsText}

PROCHAINES ÉTAPES
${DELIVERY_NEXT_STEPS[args.deliveryMethod]}

Tu peux suivre l'état de ta commande dans ton espace : https://sente.app/profil/commandes

— L'équipe Sente`;

    const itemsHtml = args.items
        .map((it) => {
            const variant = it.variant
                ? `<span style="color:#6b6b6b;font-size:13px"> — ${it.variant}</span>`
                : "";
            return `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #eee">
                    <strong>${escapeHtml(it.name)}</strong>${variant}
                    <div style="color:#6b6b6b;font-size:13px">Quantité : ${it.quantity}</div>
                </td>
                <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">
                    ${it.lineTotalEur.toFixed(2)} €
                </td>
            </tr>`;
        })
        .join("");

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f3ee;color:#1a1a1a">
    <table style="width:100%;max-width:600px;margin:0 auto;padding:32px 24px">
        <tr><td>
            <p style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#8c5e3c;margin:0 0 12px">
                Commande confirmée
            </p>
            <h1 style="font-size:32px;line-height:1.1;margin:0 0 24px;font-weight:600">
                Merci ${escapeHtml(args.customerName)}.
            </h1>
            <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
                Ta commande chez <strong>${escapeHtml(args.magasinName)}</strong> a bien été enregistrée.
            </p>

            <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
                <tr>
                    <td style="color:#6b6b6b;padding:6px 0">Numéro</td>
                    <td style="text-align:right;padding:6px 0;font-family:monospace">#${orderShort}</td>
                </tr>
                <tr>
                    <td style="color:#6b6b6b;padding:6px 0">Mode de récupération</td>
                    <td style="text-align:right;padding:6px 0">${DELIVERY_LABELS[args.deliveryMethod]}</td>
                </tr>
                <tr>
                    <td style="color:#6b6b6b;padding:6px 0">Total payé</td>
                    <td style="text-align:right;padding:6px 0;font-weight:600">${args.totalEur.toFixed(2)} €</td>
                </tr>
            </table>

            <h2 style="font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#6b6b6b;margin:32px 0 12px;font-weight:500">
                Articles
            </h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
                ${itemsHtml}
            </table>

            <div style="background:#f9f6ef;padding:20px;margin:32px 0;border-left:3px solid #8c5e3c">
                <p style="margin:0;font-size:14px;line-height:1.6">
                    <strong>Prochaines étapes</strong><br>
                    ${DELIVERY_NEXT_STEPS[args.deliveryMethod]}
                </p>
            </div>

            <p style="margin:32px 0 8px;font-size:14px">
                <a href="https://sente.app/profil/commandes" style="color:#8c5e3c;text-decoration:underline">
                    Suivre ma commande →
                </a>
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