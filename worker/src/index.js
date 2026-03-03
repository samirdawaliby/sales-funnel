/**
 * Caplogy Funnel Worker
 * ─────────────────────
 * Worker Cloudflare dedie au funnel marketing.
 * Se connecte a la meme base D1 que le data-manager.
 *
 * Routes:
 *   GET  /api/funnel/sessions              — Sessions actives (public)
 *   POST /api/funnel/register              — Inscription etudiant (public)
 *   GET  /api/funnel/session/:id/students  — Liste etudiants par session (admin)
 *   GET  /api/funnel/stats                 — Statistiques globales (admin)
 *   GET  /health                           — Health check
 */

import {
  handleGetSessions,
  handleRegister,
  handleGetStudents,
  handleGetStats,
} from './routes/funnel.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // ── CORS Preflight ──
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // ── Health Check ──
    if (pathname === '/health' && method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        worker: 'caplogy-funnel',
        timestamp: new Date().toISOString(),
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // ── API Routes ──

    // GET /api/funnel/sessions
    if (pathname === '/api/funnel/sessions' && method === 'GET') {
      return handleGetSessions(request, env);
    }

    // POST /api/funnel/register
    if (pathname === '/api/funnel/register' && method === 'POST') {
      return handleRegister(request, env, ctx);
    }

    // GET /api/funnel/session/:id/students
    const studentMatch = pathname.match(/^\/api\/funnel\/session\/(\d+)\/students$/);
    if (studentMatch && method === 'GET') {
      const sessionId = parseInt(studentMatch[1], 10);
      return handleGetStudents(request, env, sessionId);
    }

    // GET /api/funnel/stats
    if (pathname === '/api/funnel/stats' && method === 'GET') {
      return handleGetStats(request, env);
    }

    // ── 404 ──
    return new Response(JSON.stringify({
      error: 'not_found',
      message: 'Route introuvable',
      available_routes: [
        'GET  /api/funnel/sessions',
        'POST /api/funnel/register',
        'GET  /api/funnel/session/:id/students',
        'GET  /api/funnel/stats',
        'GET  /health',
      ],
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
