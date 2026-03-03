/**
 * Service Email — Microsoft Graph API
 * Envoie des emails de confirmation depuis formation@caplogy.com
 * Utilise OAuth2 Client Credentials flow
 */

// Cache token en memoire (valide ~1h, on refresh a 55min)
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Obtenir un access token Microsoft Graph (avec cache)
 */
async function getGraphToken(env) {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.AZURE_CLIENT_ID,
      client_secret: env.AZURE_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`[Email] Token error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Refresh 60 secondes avant expiration
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

/**
 * Envoyer l'email de confirmation d'inscription
 */
export async function sendConfirmationEmail(env, { lead, session }) {
  if (!env.AZURE_TENANT_ID || !env.AZURE_CLIENT_ID || !env.AZURE_CLIENT_SECRET) {
    console.error('[Email] Azure credentials non configurees');
    return;
  }

  try {
    const accessToken = await getGraphToken(env);
    const isFree = session.prix_session === 0;
    const emailHtml = buildConfirmationEmailHtml({ lead, session, isFree });

    const subject = isFree
      ? `\u2705 Confirmation : ${session.formation_name} GRATUIT \u2014 ${formatDateFR(session.date_debut)}`
      : `\u2705 Confirmation : Votre inscription ${session.formation_name}`;

    const graphUrl = 'https://graph.microsoft.com/v1.0/users/formation@caplogy.com/sendMail';

    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: emailHtml,
          },
          toRecipients: [
            {
              emailAddress: {
                address: lead.email,
                name: `${lead.prenom} ${lead.nom}`,
              },
            },
          ],
          from: {
            emailAddress: {
              address: 'formation@caplogy.com',
              name: 'Caplogy Formations',
            },
          },
        },
        saveToSentItems: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Email] Send error ${response.status}: ${errText}`);
    }
  } catch (err) {
    console.error('[Email] Send failed:', err.message);
  }
}

/**
 * Construire le HTML de l'email de confirmation
 */
function buildConfirmationEmailHtml({ lead, session, isFree }) {
  const dateDebut = formatDateFR(session.date_debut);
  const dateFin = formatDateFR(session.date_fin);

  const modaliteText =
    session.modalite === 'distanciel'
      ? '\u00c0 distance (classe virtuelle synchrone)'
      : session.modalite === 'presentiel'
        ? 'Pr\u00e9sentiel \u2014 36 Avenue de l\u2019Europe, V\u00e9lizy-Villacoublay'
        : 'Hybride (pr\u00e9sentiel + distance)';

  const prixHtml = isFree
    ? '<span style="color:#48BB78;font-weight:900;font-size:18px;">GRATUIT</span>'
    : `<span style="color:#0D3866;font-weight:700;">${session.prix_session}\u00a0\u20ac</span>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- HEADER -->
        <tr><td style="background:#0D3866;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#00eaff;font-size:28px;font-weight:800;letter-spacing:1px;">CAPLOGY</h1>
          <p style="margin:8px 0 0;color:#a0bcd8;font-size:14px;">Votre inscription est confirm\u00e9e</p>
        </td></tr>

        <!-- BODY -->
        <tr><td style="padding:40px;">
          <h2 style="color:#0D3866;font-size:22px;margin:0 0 16px;">Bonjour ${lead.prenom},</h2>

          <p style="color:#4a5568;font-size:15px;line-height:1.8;margin:0 0 24px;">
            Votre inscription \u00e0 la formation <strong style="color:#0D3866;">${session.formation_name}</strong> est bien enregistr\u00e9e. Voici le r\u00e9capitulatif :
          </p>

          <!-- DETAILS TABLE -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7fafc;border-radius:12px;border:1px solid #e2e8f0;margin:0 0 24px;">
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;color:#718096;font-size:13px;font-weight:600;width:140px;">Formation</td>
              <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;color:#1A202C;font-size:15px;font-weight:700;">${session.formation_name}</td>
            </tr>
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;color:#718096;font-size:13px;font-weight:600;">Dates</td>
              <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;color:#1A202C;font-size:15px;">Du ${dateDebut} au ${dateFin}</td>
            </tr>
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;color:#718096;font-size:13px;font-weight:600;">Modalit\u00e9</td>
              <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;color:#1A202C;font-size:15px;">${modaliteText}</td>
            </tr>
            <tr>
              <td style="padding:16px 20px;color:#718096;font-size:13px;font-weight:600;">Tarif</td>
              <td style="padding:16px 20px;">${prixHtml}</td>
            </tr>
          </table>

          <!-- WHAT'S INCLUDED -->
          <div style="background:linear-gradient(135deg,#0D3866,#1a4a7a);border-radius:12px;padding:24px;margin:0 0 24px;">
            <h3 style="color:#00eaff;font-size:16px;margin:0 0 12px;">Ce qui est inclus :</h3>
            <table cellpadding="0" cellspacing="0">
              <tr><td style="padding:4px 0;color:#e2e8f0;font-size:14px;">\u2713 Formation intensive avec formateur certifi\u00e9</td></tr>
              <tr><td style="padding:4px 0;color:#e2e8f0;font-size:14px;">\u2713 Bon d'examen officiel (voucher) inclus</td></tr>
              <tr><td style="padding:4px 0;color:#e2e8f0;font-size:14px;">\u2713 Labos pratiques et examens blancs</td></tr>
              <tr><td style="padding:4px 0;color:#e2e8f0;font-size:14px;">\u2713 Support post-formation</td></tr>
              <tr><td style="padding:4px 0;color:#e2e8f0;font-size:14px;">\u2713 \u00c9ligible CPF & OPCO</td></tr>
            </table>
          </div>

          <!-- NEXT STEPS -->
          <p style="color:#4a5568;font-size:15px;line-height:1.8;margin:0 0 8px;">
            <strong style="color:#0D3866;">Prochaines \u00e9tapes :</strong>
          </p>
          <ol style="color:#4a5568;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
            <li>Un conseiller Caplogy vous contactera sous <strong>24h</strong> pour finaliser votre dossier.</li>
            <li>Vous recevrez les acc\u00e8s \u00e0 la plateforme de pr\u00e9paration avant le d\u00e9but de la session.</li>
            <li>Rejoignez notre communaut\u00e9 Discord pour \u00e9changer avec les autres apprenants.</li>
          </ol>

          <!-- DISCORD CTA -->
          <div style="text-align:center;margin:32px 0;">
            <a href="https://discord.gg/PfDywrmY" style="display:inline-block;background:#5865F2;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">Rejoindre le Discord Caplogy</a>
          </div>

          <p style="color:#718096;font-size:13px;line-height:1.6;margin:0;">
            Si vous avez des questions, r\u00e9pondez directement \u00e0 cet email ou contactez-nous au <strong>+33 (0)1 89 16 90 08</strong>.
          </p>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#06213d;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 4px;color:#00eaff;font-size:16px;font-weight:800;">CAPLOGY</p>
          <p style="margin:0;color:#4a6a8a;font-size:12px;line-height:1.6;">
            36 Avenue de l\u2019Europe, 78140 V\u00e9lizy-Villacoublay<br>
            +33 (0)1 89 16 90 08 | contact@caplogy.com<br>
            Organisme de formation certifi\u00e9 Qualiopi
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function formatDateFR(isoDate) {
  try {
    const date = new Date(isoDate + 'T00:00:00');
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}
