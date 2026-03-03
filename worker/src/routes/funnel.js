/**
 * Routes Funnel — /api/funnel/*
 * Gere les sessions, inscriptions, et requetes admin
 */

import { sendDiscordNotification } from '../services/discord.js';
import { sendConfirmationEmail } from '../services/email.js';

/**
 * GET /api/funnel/sessions
 * Public — Retourne les sessions actives
 */
export async function handleGetSessions(request, env) {
  try {
    const results = await env.DB.prepare(`
      SELECT id, formation_slug, formation_name, date_debut, date_fin,
             prix_original, prix_session, places_max, places_restantes,
             modalite, promo_label, promo_active, logo_url, description, status
      FROM sessions
      WHERE status = 'active' AND places_restantes > 0
      ORDER BY promo_active DESC, date_debut ASC
    `).all();

    return jsonResponse({ sessions: results.results });
  } catch (err) {
    console.error('[Sessions] Error:', err.message);
    return jsonResponse({ error: 'internal_error', message: 'Erreur serveur' }, 500);
  }
}

/**
 * POST /api/funnel/register
 * Public — Inscription d'un lead a une session
 *
 * Body: { prenom, nom, email, session_id, source?, utm_campaign?, utm_medium? }
 *
 * Flow:
 * 1. Valider les champs
 * 2. Verifier la session (existe, active, places dispo)
 * 3. Upsert lead (par email unique)
 * 4. Verifier pas de double inscription
 * 5. Creer inscription + decrementer places
 * 6. Envoyer Discord + Email (non-bloquant via waitUntil)
 * 7. Retourner succes
 */
export async function handleRegister(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: 'invalid_json', message: 'Corps de requete invalide' }, 400);
  }

  const { prenom, nom, email, session_id, source, utm_campaign, utm_medium } = body;

  // 1. Validation
  if (!prenom || !nom || !email || !session_id) {
    return jsonResponse({
      success: false,
      error: 'missing_fields',
      message: 'Les champs prenom, nom, email et session_id sont requis',
    }, 400);
  }

  // Validation email basique
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({
      success: false,
      error: 'invalid_email',
      message: 'Adresse email invalide',
    }, 400);
  }

  try {
    // 2. Verifier la session
    const session = await env.DB.prepare(`
      SELECT * FROM sessions WHERE id = ? AND status = 'active'
    `).bind(session_id).first();

    if (!session) {
      return jsonResponse({
        success: false,
        error: 'session_not_found',
        message: 'Cette session n\'existe pas ou n\'est plus disponible',
      }, 404);
    }

    if (session.places_restantes <= 0) {
      return jsonResponse({
        success: false,
        error: 'session_full',
        message: 'Desolee, cette session est complete. Contactez-nous pour la prochaine session.',
      }, 409);
    }

    // 3. Upsert lead
    let lead;
    const existingLead = await env.DB.prepare(
      'SELECT * FROM leads WHERE email = ?'
    ).bind(email.toLowerCase().trim()).first();

    if (existingLead) {
      lead = existingLead;
      // Mettre a jour le nom si different
      await env.DB.prepare(`
        UPDATE leads SET prenom = ?, nom = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(prenom.trim(), nom.trim(), lead.id).run();
    } else {
      const insertResult = await env.DB.prepare(`
        INSERT INTO leads (prenom, nom, email, source, utm_campaign, utm_medium)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        prenom.trim(),
        nom.trim(),
        email.toLowerCase().trim(),
        source || 'landing-page',
        utm_campaign || null,
        utm_medium || null
      ).run();

      lead = {
        id: insertResult.meta.last_row_id,
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: email.toLowerCase().trim(),
        source: source || 'landing-page',
        utm_campaign: utm_campaign || null,
        utm_medium: utm_medium || null,
      };
    }

    // 4. Verifier double inscription
    const existingInscription = await env.DB.prepare(
      'SELECT id FROM inscriptions WHERE lead_id = ? AND session_id = ?'
    ).bind(lead.id, session_id).first();

    if (existingInscription) {
      return jsonResponse({
        success: false,
        error: 'already_registered',
        message: 'Vous etes deja inscrit(e) a cette session !',
      }, 409);
    }

    // 5. Creer inscription + decrementer places
    const inscResult = await env.DB.prepare(
      'INSERT INTO inscriptions (lead_id, session_id) VALUES (?, ?)'
    ).bind(lead.id, session_id).run();

    await env.DB.prepare(`
      UPDATE sessions SET places_restantes = places_restantes - 1, updated_at = datetime('now')
      WHERE id = ? AND places_restantes > 0
    `).bind(session_id).run();

    // Auto-completer si plus de places
    await env.DB.prepare(`
      UPDATE sessions SET status = 'complet'
      WHERE id = ? AND places_restantes <= 0
    `).bind(session_id).run();

    // Re-lire les places restantes apres decrement
    const updatedSession = await env.DB.prepare(
      'SELECT places_restantes, places_max FROM sessions WHERE id = ?'
    ).bind(session_id).first();

    // 6. Notifications async (non-bloquant)
    const notificationData = {
      lead: {
        prenom: lead.prenom || prenom.trim(),
        nom: lead.nom || nom.trim(),
        email: lead.email || email.toLowerCase().trim(),
        source: lead.source || source || 'landing-page',
        utm_campaign: lead.utm_campaign || utm_campaign,
      },
      session: {
        ...session,
        places_restantes: updatedSession?.places_restantes ?? session.places_restantes - 1,
      },
    };

    // waitUntil permet d'envoyer Discord + Email apres la reponse HTTP
    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(sendDiscordNotification(env, notificationData));
      ctx.waitUntil(sendConfirmationEmail(env, notificationData));
    } else {
      // Fallback: envoyer sans waitUntil
      sendDiscordNotification(env, notificationData).catch(console.error);
      sendConfirmationEmail(env, notificationData).catch(console.error);
    }

    // Marquer les notifications comme envoyees
    await env.DB.prepare(`
      UPDATE inscriptions SET discord_notified = 1, email_sent = 1 WHERE id = ?
    `).bind(inscResult.meta.last_row_id).run();

    // 7. Succes
    return jsonResponse({
      success: true,
      message: 'Inscription confirmee ! Verifiez votre boite email.',
      inscription_id: inscResult.meta.last_row_id,
      session: {
        formation_name: session.formation_name,
        date_debut: session.date_debut,
        date_fin: session.date_fin,
        places_restantes: updatedSession?.places_restantes ?? session.places_restantes - 1,
      },
    });

  } catch (err) {
    console.error('[Register] Error:', err.message, err.stack);
    return jsonResponse({
      success: false,
      error: 'internal_error',
      message: 'Erreur serveur. Veuillez reessayer ou nous contacter.',
    }, 500);
  }
}

/**
 * GET /api/funnel/session/:id/students
 * Admin — Liste les etudiants inscrits a une session
 * Requiert header X-Admin-Password
 */
export async function handleGetStudents(request, env, sessionId) {
  // Verification admin
  const password = request.headers.get('X-Admin-Password');
  if (!password || password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'unauthorized', message: 'Mot de passe admin requis' }, 401);
  }

  try {
    // Info session
    const session = await env.DB.prepare(
      'SELECT id, formation_name, date_debut, date_fin, places_max, places_restantes, status FROM sessions WHERE id = ?'
    ).bind(sessionId).first();

    if (!session) {
      return jsonResponse({ error: 'not_found', message: 'Session introuvable' }, 404);
    }

    // Liste des etudiants
    const students = await env.DB.prepare(`
      SELECT
        i.id AS inscription_id,
        l.prenom,
        l.nom,
        l.email,
        l.telephone,
        l.source,
        i.status,
        i.discord_notified,
        i.email_sent,
        i.notes,
        i.created_at AS inscrit_le
      FROM inscriptions i
      JOIN leads l ON l.id = i.lead_id
      WHERE i.session_id = ?
      ORDER BY i.created_at DESC
    `).bind(sessionId).all();

    return jsonResponse({
      session,
      students: students.results,
      total: students.results.length,
    });

  } catch (err) {
    console.error('[Students] Error:', err.message);
    return jsonResponse({ error: 'internal_error', message: 'Erreur serveur' }, 500);
  }
}

/**
 * GET /api/funnel/stats
 * Admin — Statistiques globales du funnel
 */
export async function handleGetStats(request, env) {
  const password = request.headers.get('X-Admin-Password');
  if (!password || password !== env.ADMIN_PASSWORD) {
    return jsonResponse({ error: 'unauthorized', message: 'Mot de passe admin requis' }, 401);
  }

  try {
    const totalLeads = await env.DB.prepare('SELECT COUNT(*) as count FROM leads').first();
    const totalInscriptions = await env.DB.prepare('SELECT COUNT(*) as count FROM inscriptions').first();
    const activeSessions = await env.DB.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'active'").first();

    const recentLeads = await env.DB.prepare(`
      SELECT prenom, nom, email, source, created_at
      FROM leads ORDER BY created_at DESC LIMIT 10
    `).all();

    const sessionStats = await env.DB.prepare(`
      SELECT s.id, s.formation_name, s.date_debut, s.places_max, s.places_restantes,
             COUNT(i.id) as nb_inscrits
      FROM sessions s
      LEFT JOIN inscriptions i ON i.session_id = s.id
      GROUP BY s.id
      ORDER BY s.date_debut DESC
    `).all();

    return jsonResponse({
      total_leads: totalLeads.count,
      total_inscriptions: totalInscriptions.count,
      active_sessions: activeSessions.count,
      recent_leads: recentLeads.results,
      sessions: sessionStats.results,
    });

  } catch (err) {
    console.error('[Stats] Error:', err.message);
    return jsonResponse({ error: 'internal_error' }, 500);
  }
}

// ── Helper ──
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    },
  });
}
