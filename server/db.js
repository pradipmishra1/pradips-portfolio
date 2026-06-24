// ═══════════════════════════════════════════════════════════════
// DATABASE LAYER — SQLite via Node's built-in node:sqlite module.
// No native compilation required (unlike better-sqlite3), so this
// installs cleanly on Windows without Visual Studio Build Tools.
// Single file DB, zero config, easy to back up (just copy data.db)
// ═══════════════════════════════════════════════════════════════
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// node:sqlite has no built-in db.transaction() helper (unlike
// better-sqlite3), so this small helper wraps a function call in a
// manual BEGIN/COMMIT, rolling back on error.
function runInTransaction(fn) {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ── SCHEMA ──
db.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,         -- thumbnail | logo | web | poster | creative
  description TEXT,
  image TEXT,                     -- filename in /uploads
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  tags TEXT,                      -- comma separated
  icon TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT,
  stars INTEGER DEFAULT 5,
  text TEXT NOT NULL,
  approved INTEGER DEFAULT 0,     -- needs admin approval before showing publicly
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  service TEXT,
  message TEXT,
  source TEXT DEFAULT 'contact_form', -- contact_form | brief_generator | lead_capture
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id TEXT PRIMARY KEY,    -- random ID stored in the visitor's browser (localStorage)
  messages TEXT NOT NULL DEFAULT '[]', -- JSON array of {role, content}
  lead_name TEXT,
  lead_contact TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pricing_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  tagline TEXT,
  features TEXT,                  -- newline separated
  featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
`);

// ── SEED DEFAULT SETTINGS (only if empty) ──
const settingsCount = db.prepare('SELECT COUNT(*) c FROM site_settings').get().c;
if (settingsCount === 0) {
  const defaults = {
    site_title: 'Pradip Mishra — Designer & Developer',
    hero_tag: 'Available for freelance',
    hero_heading_1: 'Creative',
    hero_heading_2: 'Designer',
    hero_heading_3: '& Developer',
    hero_desc: "I'm Pradip — a graphic designer & web developer from Nepal crafting bold visuals, stunning websites, and click-worthy thumbnails that get results.",
    stat_projects: '48',
    stat_clients: '24',
    stat_earned: '$2.5k',
    about_text: "I'm a graphic designer and web developer based in Nepal with 2+ years of freelance experience. Started from pure curiosity — quickly became my passion.\n\nCurrently studying BCA, I blend creative design with technical development to deliver complete digital solutions. Worked with 20+ clients worldwide across thumbnails, branding, and web projects.\n\nGood design isn't just about looking pretty — it solves problems, drives clicks, and builds brands people remember.",
    email: 'business.tetsuo@gmail.com',
    whatsapp: '9779843122166',
    instagram: 'https://www.instagram.com/pradip21211',
    facebook: 'https://www.facebook.com/share/1FXTQ8fUhg/',
    github: 'https://github.com/pradipmishra1',
    telegram: 'https://t.me/Pradipmishra123',
  };
  const ins = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)');
  runInTransaction(() => {
    for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
  });
}

// ── SEED DEFAULT SERVICES (only if empty) ──
const svcCount = db.prepare('SELECT COUNT(*) c FROM services').get().c;
if (svcCount === 0) {
  const ins = db.prepare('INSERT INTO services (title, description, tags, icon, sort_order) VALUES (?,?,?,?,?)');
  const rows = [
    ['Website Design & Dev', 'Fast, responsive websites that look stunning on every screen. Built with clean, hand-crafted code.', 'HTML/CSS,JavaScript,Figma', '💻', 1],
    ['Logo & Brand Identity', 'Memorable logos and brand identities that tell your story. Vector-based, fully scalable, all formats.', 'Illustrator,Branding,Vector', '✦', 2],
    ['YouTube Thumbnails', 'Click-worthy thumbnails that boost CTR and get more views. Bold, dramatic, designed to stop the scroll.', 'Photoshop,CTR Optimized', '▶', 3],
    ['Posters & Social Media', 'Scroll-stopping posters, banners, and social media graphics. Print-ready or digital.', 'Photoshop,After Effects', '◈', 4],
  ];
  runInTransaction(() => { for (const r of rows) ins.run(...r); });
}

// ── SEED DEFAULT PRICING (only if empty) ──
const priceCount = db.prepare('SELECT COUNT(*) c FROM pricing_plans').get().c;
if (priceCount === 0) {
  const ins = db.prepare('INSERT INTO pricing_plans (name, price, tagline, features, featured, sort_order) VALUES (?,?,?,?,?,?)');
  const rows = [
    ['Starter', '$15', 'Per project — great for quick tasks', '1 Logo or Thumbnail\n2 Revisions included\n24–48hr delivery\nAll source files\nCommercial use rights', 0, 1],
    ['Standard', '$50', 'Best value — complete projects', 'Logo + Brand Package\nOr Landing Page Design\n5 Revisions included\n48–72hr delivery\nAll source files\nPriority support', 1, 2],
    ['Premium', '$120', 'Full website or complete brand kit', 'Full Website (5 pages)\nLogo + Brand Identity\nSocial media kit\nUnlimited revisions\n5–7 day delivery\n1 month free support', 0, 3],
  ];
  runInTransaction(() => { for (const r of rows) ins.run(...r); });
}

// ── SEED SAMPLE REVIEWS (only if empty) ──
const revCount = db.prepare('SELECT COUNT(*) c FROM reviews').get().c;
if (revCount === 0) {
  const ins = db.prepare('INSERT INTO reviews (name, role, stars, text, approved) VALUES (?,?,?,?,1)');
  const rows = [
    ['Sarah Johnson', 'YouTube Creator', 5, 'Pradip designed an amazing set of thumbnails for my YouTube channel. My CTR increased by 45%! Highly recommended.'],
    ['Mark Williams', 'Business Owner', 4, 'Great designer with an eye for detail. The logo he created perfectly represents our brand identity. Will work with him again.'],
    ['Jessica Miller', 'Marketing Manager', 5, "Pradip's motion graphics work is exceptional. Delivered exactly what we needed and exceeded our expectations. Professional!"],
  ];
  runInTransaction(() => { for (const r of rows) ins.run(...r); });
}

module.exports = db;
module.exports.runInTransaction = runInTransaction;