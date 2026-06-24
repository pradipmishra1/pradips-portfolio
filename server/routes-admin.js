// ═══════════════════════════════════════════════════════════════
// ADMIN API — protected by requireAuth middleware (mounted in index.js)
// Full CRUD for projects, services, pricing, reviews, settings,
// plus reading contact messages and image uploads.
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const router = express.Router();
const db = require('./db');
const { upload, processAndSave } = require('./upload');

// ───────────────────────── PROJECTS ─────────────────────────
router.get('/projects', (req, res) => {
  res.json(db.prepare('SELECT * FROM projects ORDER BY sort_order ASC, id DESC').all());
});

router.post('/projects', upload.single('image'), async (req, res) => {
  try {
    const { title, category, description, sort_order } = req.body;
    if (!title || !category) return res.status(400).json({ error: 'Title and category are required' });

    let filename = null;
    if (req.file) filename = await processAndSave(req.file.buffer, { maxWidth: 1600 });

    const result = db.prepare(
      'INSERT INTO projects (title, category, description, image, sort_order) VALUES (?,?,?,?,?)'
    ).run(title.trim(), category.trim(), (description || '').trim(), filename, parseInt(sort_order) || 0);

    res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to create project' });
  }
});

router.put('/projects/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    const { title, category, description, sort_order } = req.body;
    let filename = existing.image;
    if (req.file) filename = await processAndSave(req.file.buffer, { maxWidth: 1600 });

    db.prepare(
      'UPDATE projects SET title=?, category=?, description=?, image=?, sort_order=?, updated_at=datetime("now") WHERE id=?'
    ).run(
      title ?? existing.title,
      category ?? existing.category,
      description ?? existing.description,
      filename,
      sort_order !== undefined ? parseInt(sort_order) || 0 : existing.sort_order,
      id
    );

    res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to update project' });
  }
});

router.delete('/projects/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ───────────────────────── SERVICES ─────────────────────────
router.get('/services', (req, res) => {
  res.json(db.prepare('SELECT * FROM services ORDER BY sort_order ASC, id ASC').all());
});

router.post('/services', upload.single('image'), async (req, res) => {
  try {
    const { title, description, tags, icon, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    let filename = null;
    if (req.file) filename = await processAndSave(req.file.buffer, { maxWidth: 1000 });
    const result = db.prepare(
      'INSERT INTO services (title, description, image, tags, icon, sort_order) VALUES (?,?,?,?,?,?)'
    ).run(title.trim(), (description || '').trim(), filename, (tags || '').trim(), (icon || '✦').trim(), parseInt(sort_order) || 0);
    res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to create service' });
  }
});

router.put('/services/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Service not found' });
    const { title, description, tags, icon, sort_order } = req.body;
    let filename = existing.image;
    if (req.file) filename = await processAndSave(req.file.buffer, { maxWidth: 1000 });
    db.prepare(
      'UPDATE services SET title=?, description=?, image=?, tags=?, icon=?, sort_order=? WHERE id=?'
    ).run(
      title ?? existing.title,
      description ?? existing.description,
      filename,
      tags ?? existing.tags,
      icon ?? existing.icon,
      sort_order !== undefined ? parseInt(sort_order) || 0 : existing.sort_order,
      id
    );
    res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Failed to update service' });
  }
});

router.delete('/services/:id', (req, res) => {
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ───────────────────────── PRICING ─────────────────────────
router.get('/pricing', (req, res) => {
  res.json(db.prepare('SELECT * FROM pricing_plans ORDER BY sort_order ASC, id ASC').all());
});

router.post('/pricing', (req, res) => {
  const { name, price, tagline, features, featured, sort_order } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });
  const result = db.prepare(
    'INSERT INTO pricing_plans (name, price, tagline, features, featured, sort_order) VALUES (?,?,?,?,?,?)'
  ).run(name.trim(), price.trim(), (tagline || '').trim(), (features || '').trim(), featured ? 1 : 0, parseInt(sort_order) || 0);
  res.json(db.prepare('SELECT * FROM pricing_plans WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/pricing/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM pricing_plans WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Plan not found' });
  const { name, price, tagline, features, featured, sort_order } = req.body;
  db.prepare(
    'UPDATE pricing_plans SET name=?, price=?, tagline=?, features=?, featured=?, sort_order=? WHERE id=?'
  ).run(
    name ?? existing.name, price ?? existing.price, tagline ?? existing.tagline,
    features ?? existing.features, featured !== undefined ? (featured ? 1 : 0) : existing.featured,
    sort_order !== undefined ? parseInt(sort_order) || 0 : existing.sort_order, id
  );
  res.json(db.prepare('SELECT * FROM pricing_plans WHERE id = ?').get(id));
});

router.delete('/pricing/:id', (req, res) => {
  db.prepare('DELETE FROM pricing_plans WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ───────────────────────── REVIEWS ─────────────────────────
router.get('/reviews', (req, res) => {
  res.json(db.prepare('SELECT * FROM reviews ORDER BY id DESC').all());
});

router.put('/reviews/:id/approve', (req, res) => {
  db.prepare('UPDATE reviews SET approved = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/reviews/:id/unapprove', (req, res) => {
  db.prepare('UPDATE reviews SET approved = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/reviews/:id', (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ───────────────────────── MESSAGES (contact/leads) ─────────────────────────
router.get('/messages', (req, res) => {
  res.json(db.prepare('SELECT * FROM messages ORDER BY id DESC').all());
});

router.put('/messages/:id/read', (req, res) => {
  db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/messages/:id', (req, res) => {
  db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ───────────────────────── SETTINGS ─────────────────────────
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Invalid payload' });
  const upsert = db.prepare(
    'INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  db.runInTransaction(() => {
    for (const [k, v] of Object.entries(updates)) upsert.run(k, String(v));
  });
  res.json({ ok: true });
});

// ───────────────────────── DASHBOARD STATS ─────────────────────────
router.get('/stats', (req, res) => {
  const projects = db.prepare('SELECT COUNT(*) c FROM projects').get().c;
  const pendingReviews = db.prepare('SELECT COUNT(*) c FROM reviews WHERE approved = 0').get().c;
  const totalReviews = db.prepare('SELECT COUNT(*) c FROM reviews').get().c;
  const unreadMessages = db.prepare('SELECT COUNT(*) c FROM messages WHERE read = 0').get().c;
  const totalMessages = db.prepare('SELECT COUNT(*) c FROM messages').get().c;
  res.json({ projects, pendingReviews, totalReviews, unreadMessages, totalMessages });
});

module.exports = router;