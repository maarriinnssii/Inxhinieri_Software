const express = require('express');
const { getDb } = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
const isAdmin = [authMiddleware, requireRole(['admin'])];

// GET /api/admin/stats
router.get('/stats', ...isAdmin, (req, res) => {
  const db = getDb();
  res.json({
    total_users: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
    total_events: db.prepare('SELECT COUNT(*) AS c FROM events').get().c,
    published_events: db.prepare("SELECT COUNT(*) AS c FROM events WHERE statusi='publikuar'").get().c,
    total_rsvp_confirmed: db.prepare("SELECT COUNT(*) AS c FROM rsvp WHERE statusi='konfirmuar'").get().c,
    total_qr: db.prepare('SELECT COUNT(*) AS c FROM qrcodes').get().c
  });
});

// GET /api/admin/users
router.get('/users', ...isAdmin, (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT id, emri, mbiemri, email, roli, created_at FROM users ORDER BY created_at DESC').all());
});

// PUT /api/admin/users/:id
router.put('/users/:id', ...isAdmin, (req, res) => {
  const { roli } = req.body;
  const valid = ['pjesemarres', 'organizator', 'staf', 'admin'];
  if (!valid.includes(roli)) return res.status(400).json({ error: 'Rol i pavlefshëm.' });
  const db = getDb();
  db.prepare('UPDATE users SET roli = ? WHERE id = ?').run(roli, req.params.id);
  res.json({ message: 'Roli u përditësua me sukses.' });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', ...isAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Nuk mund të fshini llogarinë tuaj.' });
  }
  const db = getDb();
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'Përdoruesi u fshi me sukses.' });
});

// GET /api/admin/events
router.get('/events', ...isAdmin, (req, res) => {
  const db = getDb();
  const events = db.prepare(`
    SELECT e.*, u.emri || ' ' || u.mbiemri AS organizatori_emri,
      (SELECT COUNT(*) FROM rsvp WHERE event_id = e.id AND statusi = 'konfirmuar') AS pjesemarres
    FROM events e
    JOIN users u ON e.organizatori_id = u.id
    ORDER BY e.created_at DESC
  `).all();
  res.json(events);
});

// DELETE /api/admin/events/:id
router.delete('/events/:id', ...isAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ message: 'Eventi u fshi me sukses.' });
});

module.exports = router;
