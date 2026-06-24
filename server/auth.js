// ═══════════════════════════════════════════════════════════════
// AUTH — bcrypt password hashing + JWT sessions (httpOnly cookie)
// ═══════════════════════════════════════════════════════════════
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Add it to your .env file (see .env.example).');
}

const COOKIE_NAME = 'pm_admin_session';
const TOKEN_TTL = '7d';

// ── Ensure exactly one admin user exists, matching env credentials ──
function ensureAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error('ADMIN_PASSWORD is not set. Add it to your .env file (see .env.example).');
  }

  const existing = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  const hash = bcrypt.hashSync(password, 12);

  if (!existing) {
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`✓ Admin user created: ${username}`);
  } else {
    // Keep the password in sync with .env so changing .env always takes effect on restart
    if (!bcrypt.compareSync(password, existing.password_hash)) {
      db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(hash, username);
      console.log(`✓ Admin password updated from .env for: ${username}`);
    }
  }
}

function verifyLogin(username, password) {
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!user) return false;
  return bcrypt.compareSync(password, user.password_hash);
}

function issueToken(username) {
  return jwt.sign({ username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// ── Middleware: protect admin API routes ──
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

module.exports = {
  ensureAdminUser,
  verifyLogin,
  issueToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  COOKIE_NAME,
};
