-- ============================================================
-- CAPLOGY FUNNEL — Schema D1
-- A executer sur la meme base D1 que le data-manager
-- ============================================================

-- Table SESSIONS : une formation peut avoir plusieurs sessions
-- Chaque session = une "classe" avec dates, prix, places
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    formation_slug TEXT NOT NULL,            -- 'comptia-sec', 'comptia-a', 'azure', 'ccna'...
    formation_name TEXT NOT NULL,            -- 'CompTIA Security+'
    date_debut TEXT NOT NULL,                -- ISO date: '2026-03-10'
    date_fin TEXT NOT NULL,                  -- ISO date: '2026-03-14'
    prix_original REAL NOT NULL DEFAULT 0,   -- prix affiche barre (ex: 2990.00)
    prix_session REAL NOT NULL DEFAULT 0,    -- prix reel de cette session (0 = gratuit)
    places_max INTEGER DEFAULT 20,
    places_restantes INTEGER DEFAULT 20,
    status TEXT NOT NULL DEFAULT 'active',   -- 'active', 'complet', 'archive'
    modalite TEXT DEFAULT 'distanciel',      -- 'distanciel', 'presentiel', 'hybride'
    promo_label TEXT,                        -- texte promo: 'GRATUIT', 'OFFERT', '-50%'
    promo_active INTEGER DEFAULT 0,          -- 1 = afficher popup promo sur landing page
    logo_url TEXT,                           -- URL vers le logo de la certification (R2)
    description TEXT,                        -- description courte de la session
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Table LEADS : les prospects captures par le funnel
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prenom TEXT NOT NULL,
    nom TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    telephone TEXT,
    source TEXT,                             -- utm_source ou 'landing-page', 'instagram', 'linkedin'
    utm_campaign TEXT,
    utm_medium TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Table INSCRIPTIONS : junction lead <-> session (= une "classe")
-- Permet de filtrer tous les etudiants d'une session donnee
CREATE TABLE IF NOT EXISTS inscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'inscrit',  -- 'inscrit', 'confirme', 'annule', 'present', 'absent'
    discord_notified INTEGER DEFAULT 0,      -- 1 = notification Discord envoyee
    email_sent INTEGER DEFAULT 0,            -- 1 = email de confirmation envoye
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lead_id) REFERENCES leads(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Index unique pour empecher les doubles inscriptions
CREATE UNIQUE INDEX IF NOT EXISTS idx_inscription_unique ON inscriptions(lead_id, session_id);

-- Index pour recherche rapide par email
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Index pour filtrer les sessions actives
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(status, promo_active);

-- ============================================================
-- SEED DATA : Premiere session CompTIA Security+ GRATUIT Mars 2026
-- ============================================================

INSERT OR IGNORE INTO sessions (
    formation_slug, formation_name, date_debut, date_fin,
    prix_original, prix_session, places_max, places_restantes,
    status, modalite, promo_label, promo_active, description
) VALUES (
    'comptia-sec',
    'CompTIA Security+',
    '2026-03-10',
    '2026-03-14',
    2990.00,
    0.00,
    20,
    20,
    'active',
    'distanciel',
    'GRATUIT',
    1,
    'Formation intensive 5 jours - Bon d''examen inclus - Labos pratiques - Eligible CPF & OPCO'
);
