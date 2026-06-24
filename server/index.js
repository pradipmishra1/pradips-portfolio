// ═══════════════════════════════════════════════════════════════
// SERVER ENTRY POINT
// ═══════════════════════════════════════════════════════════════
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const auth = require('./auth');
const { upload, processAndSave, UPLOAD_DIR } = require('./upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy if behind one (Render/Railway/etc set this up automatically, safe default)
app.set('trust proxy', 1);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Ensure admin user exists / synced from .env on every boot ──
auth.ensureAdminUser();

// ── Static files ──
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html' }));

// ───────────────────────── AUTH ROUTES ─────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const ok = auth.verifyLogin(username, password);
  if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

  const token = auth.issueToken(username);
  auth.setSessionCookie(res, token);
  res.json({ ok: true, username });
});

app.post('/api/auth/logout', (req, res) => {
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', auth.requireAuth, (req, res) => {
  res.json({ username: req.admin.username });
});

// ───────────────────────── PUBLIC API ─────────────────────────
// Raised from 120 to 300: persistent chat history now saves after every
// message exchange, which adds up quickly over a single real conversation.
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', publicLimiter, require('./routes-public'));

// ───────────────────────── AI ROUTES (own internal rate limit) ─────────────────────────
app.use('/api/ai', require('./routes-ai'));

// ───────────────────────── ADMIN API (protected) ─────────────────────────
app.use('/api/admin', auth.requireAuth, require('./routes-admin'));

// ───────────────────────── ADMIN PANEL (serve the SPA, auth checked client-side + by API) ─────────────────────────
app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html'));
});

// ───────────────────────── FALLBACK → main site ─────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ───────────────────────── ERROR HANDLER ─────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (err.message?.includes('Only JPG')) return res.status(400).json({ error: err.message });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 12MB)' });
  res.status(500).json({ error: 'Something went wrong on the server' });
});

app.listen(PORT, () => {
  console.log(`\n  🚀 Pradip Mishra Portfolio running at http://localhost:${PORT}`);
  console.log(`  🔐 Admin panel at http://localhost:${PORT}/admin\n`);
});