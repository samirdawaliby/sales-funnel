/**
 * Service Discord — Webhook notifications
 * Envoie une notification riche (embed) quand un etudiant s'inscrit
 */

export async function sendDiscordNotification(env, { lead, session }) {
  const webhookUrl = env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[Discord] DISCORD_WEBHOOK_URL non configure');
    return;
  }

  const isFree = session.prix_session === 0;
  const prixDisplay = isFree ? 'GRATUIT' : `${session.prix_session} EUR`;

  // Formater les dates en francais
  const dateDebut = formatDateFR(session.date_debut);
  const dateFin = formatDateFR(session.date_fin);

  const embed = {
    title: '\ud83c\udf93 Nouvelle inscription !',
    color: 0x00eaff, // Caplogy cyan
    fields: [
      {
        name: '\ud83d\udc64 Etudiant',
        value: `**${lead.prenom} ${lead.nom}**`,
        inline: true,
      },
      {
        name: '\ud83d\udce7 Email',
        value: lead.email,
        inline: true,
      },
      {
        name: '\ud83d\udcda Formation',
        value: session.formation_name,
        inline: false,
      },
      {
        name: '\ud83d\udcc5 Session',
        value: `${dateDebut} au ${dateFin}`,
        inline: true,
      },
      {
        name: '\ud83d\udcb0 Prix',
        value: prixDisplay,
        inline: true,
      },
      {
        name: '\ud83d\udc65 Places restantes',
        value: `${session.places_restantes}/${session.places_max}`,
        inline: true,
      },
    ],
    footer: {
      text: `Source: ${lead.source || 'landing-page'}${lead.utm_campaign ? ' | Campagne: ' + lead.utm_campaign : ''}`,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Caplogy Funnel',
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      console.error(`[Discord] Webhook error: ${response.status} ${await response.text()}`);
    }
  } catch (err) {
    console.error('[Discord] Webhook failed:', err.message);
  }
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
