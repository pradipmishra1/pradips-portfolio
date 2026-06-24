// ═══════════════════════════════════════════════════════════════
// PUBLIC API — read-only data for the site, plus form submissions
// and chat session persistence. No auth required, but rate-limited
// to prevent spam/abuse.
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const db = require('./db');

// ── Settings (hero text, about text, social links, etc.) ──
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

// ── Projects (portfolio work) ──
router.get('/projects', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY sort_order ASC, id DESC').all();
  res.json(rows);
});

// ── Services ──
router.get('/services', (req, res) => {
  const rows = db.prepare('SELECT * FROM services ORDER BY sort_order ASC, id ASC').all();
  res.json(rows);
});

// ── Pricing plans ──
router.get('/pricing', (req, res) => {
  const rows = db.prepare('SELECT * FROM pricing_plans ORDER BY sort_order ASC, id ASC').all();
  res.json(rows);
});

// ── Approved reviews only (admin must approve before public sees them) ──
router.get('/reviews', (req, res) => {
  const rows = db.prepare('SELECT * FROM reviews WHERE approved = 1 ORDER BY id DESC').all();
  res.json(rows);
});

// ── Submit a new review (goes in unapproved, admin reviews it) ──
router.post('/reviews', (req, res) => {
  const { name, role, stars, text } = req.body;
  if (!name || !text || typeof name !== 'string' || typeof text !== 'string') {
    return res.status(400).json({ error: 'Name and review text are required' });
  }
  if (name.length > 100 || text.length > 1000) {
    return res.status(400).json({ error: 'Input too long' });
  }
  const safeStars = Math.min(5, Math.max(1, parseInt(stars) || 5));
  db.prepare('INSERT INTO reviews (name, role, stars, text, approved) VALUES (?,?,?,?,0)')
    .run(name.trim(), (role || 'Client').trim(), safeStars, text.trim());
  res.json({ ok: true, message: 'Thanks! Your review will appear after a quick check.' });
});

// ── Contact form submission ──
router.post('/contact', (req, res) => {
  const { name, email, service, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required' });
  }
  if (String(name).length > 150 || String(message).length > 3000) {
    return res.status(400).json({ error: 'Input too long' });
  }
  db.prepare('INSERT INTO messages (name, email, service, message, source) VALUES (?,?,?,?,?)')
    .run(String(name).trim(), String(email).trim(), String(service || '').trim(), String(message).trim(), 'contact_form');
  res.json({ ok: true });
});

// ── Lead capture (from AI chat widget) ──
router.post('/leads', (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
  db.prepare('INSERT INTO messages (name, email, service, message, source) VALUES (?,?,?,?,?)')
    .run(String(name).trim(), '', '', `WhatsApp: ${String(phone).trim()}`, 'lead_capture');
  res.json({ ok: true });
});

// ── Chat session persistence (so returning visitors don't restart from zero) ──
// session_id is a random token generated and stored in the visitor's own
// browser (localStorage) — it identifies a conversation, not a person.
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{10,64}$/;

router.get('/chat/session/:id', (req, res) => {
  const { id } = req.params;
  if (!SESSION_ID_RE.test(id)) return res.status(400).json({ error: 'Invalid session id' });
  const row = db.prepare('SELECT messages, lead_name, lead_contact FROM chat_sessions WHERE session_id = ?').get(id);
  if (!row) return res.json({ messages: [], lead_name: null, lead_contact: null });
  let messages = [];
  try { messages = JSON.parse(row.messages); } catch (e) { messages = []; }
  res.json({ messages, lead_name: row.lead_name, lead_contact: row.lead_contact });
});

router.put('/chat/session/:id', (req, res) => {
  const { id } = req.params;
  if (!SESSION_ID_RE.test(id)) return res.status(400).json({ error: 'Invalid session id' });
  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });
  // Cap stored history so a single session can't grow the DB unbounded
  const trimmed = messages.slice(-60);
  const json = JSON.stringify(trimmed);
  if (json.length > 50000) return res.status(400).json({ error: 'Chat history too large' });

  const existing = db.prepare('SELECT session_id FROM chat_sessions WHERE session_id = ?').get(id);
  if (existing) {
    db.prepare('UPDATE chat_sessions SET messages = ?, updated_at = datetime("now") WHERE session_id = ?').run(json, id);
  } else {
    db.prepare('INSERT INTO chat_sessions (session_id, messages) VALUES (?, ?)').run(id, json);
  }
  res.json({ ok: true });
});

// ── Capture a lead's name/contact against their chat session ──
router.put('/chat/session/:id/lead', (req, res) => {
  const { id } = req.params;
  if (!SESSION_ID_RE.test(id)) return res.status(400).json({ error: 'Invalid session id' });
  const { name, contact } = req.body;
  if (!name || !contact) return res.status(400).json({ error: 'Name and contact are required' });
  if (String(name).length > 100 || String(contact).length > 100) {
    return res.status(400).json({ error: 'Input too long' });
  }

  const existing = db.prepare('SELECT session_id FROM chat_sessions WHERE session_id = ?').get(id);
  if (existing) {
    db.prepare('UPDATE chat_sessions SET lead_name = ?, lead_contact = ?, updated_at = datetime("now") WHERE session_id = ?')
      .run(String(name).trim(), String(contact).trim(), id);
  } else {
    db.prepare('INSERT INTO chat_sessions (session_id, lead_name, lead_contact) VALUES (?, ?, ?)')
      .run(id, String(name).trim(), String(contact).trim());
  }
  // Also log it as a message so it shows up in the admin Messages inbox
  db.prepare('INSERT INTO messages (name, email, service, message, source) VALUES (?,?,?,?,?)')
    .run(String(name).trim(), '', '', `Chat lead — contact: ${String(contact).trim()}`, 'lead_capture');
  res.json({ ok: true });
});

module.exports = router;