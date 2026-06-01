const express = require('express');
const { getDb } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');
const { createNotification } = require('../utils/emailService');

const router = express.Router();

// POST /api/rsvp — register for event
router.post('/', authMiddleware, (req, res) => {
  const { event_id } = req.body;
  if (!event_id) return res.status(400).json({ error: 'ID e eventit është e detyrueshme.' });

  const db = getDb();
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(event_id);
  if (!event) return res.status(404).json({ error: 'Eventi nuk u gjet.' });
  if (event.statusi !== 'publikuar') return res.status(400).json({ error: 'Ky event nuk është i hapur për regjistrim.' });

  const confirmed = db.prepare("SELECT COUNT(*) AS cnt FROM rsvp WHERE event_id = ? AND statusi = 'konfirmuar'").get(event_id);
  if (confirmed.cnt >= event.kapaciteti) {
    return res.status(400).json({ error: 'Kapaciteti i eventit është mbushur.' });
  }

  const existing = db.prepare('SELECT * FROM rsvp WHERE perdorues_id = ? AND event_id = ?').get(req.user.id, event_id);
  if (existing) return res.status(400).json({ error: 'Jeni regjistruar tashmë në këtë event.' });

  const result = db.prepare('INSERT INTO rsvp (perdorues_id, event_id) VALUES (?,?)').run(req.user.id, event_id);

  createNotification(db, req.user.id, 'regjistrim',
    `Regjistrimi juaj në eventin "${event.titulli}" është pranuar. Konfirmoni pjesëmarrjen tuaj.`);

  const rsvp = db.prepare('SELECT * FROM rsvp WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ rsvp, message: 'U regjistruat me sukses! Konfirmoni pjesëmarrjen tuaj.' });
});

// PUT /api/rsvp/:id — update RSVP status
router.put('/:id', authMiddleware, (req, res) => {
  const { statusi } = req.body;
  const db = getDb();

  const rsvp = db.prepare('SELECT * FROM rsvp WHERE id = ?').get(req.params.id);
  if (!rsvp) return res.status(404).json({ error: 'RSVP nuk u gjet.' });
  if (rsvp.perdorues_id !== req.user.id) return res.status(403).json({ error: 'Nuk keni leje.' });

  const valid = ['konfirmuar', 'refuzuar', 'anuluar'];
  if (!valid.includes(statusi)) return res.status(400).json({ error: 'Status i pavlefshëm.' });

  const koha = statusi === 'konfirmuar' ? new Date().toISOString() : null;
  db.prepare('UPDATE rsvp SET statusi = ?, koha_konfirmimit = ? WHERE id = ?').run(statusi, koha, req.params.id);

  if (statusi === 'konfirmuar') {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(rsvp.event_id);
    createNotification(db, req.user.id, 'konfirmim',
      `Pjesëmarrja juaj në eventin "${event.titulli}" u konfirmua. Mund të gjeneroni kodin tuaj QR.`);
  }

  const updated = db.prepare('SELECT * FROM rsvp WHERE id = ?').get(req.params.id);
  res.json({ rsvp: updated, message: `RSVP u përditësua: ${statusi}` });
});

// GET /api/rsvp/my — current user's RSVPs
router.get('/my', authMiddleware, (req, res) => {
  const db = getDb();
  const rsvps = db.prepare(`
    SELECT r.*, e.titulli, e.data, e.ora, e.vendndodhja, e.statusi AS event_statusi,
      q.kodi_unik, q.statusi AS qr_statusi, q.id AS qr_id
    FROM rsvp r
    JOIN events e ON r.event_id = e.id
    LEFT JOIN qrcodes q ON q.perdorues_id = r.perdorues_id AND q.event_id = r.event_id
    WHERE r.perdorues_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user.id);
  res.json(rsvps);
});

module.exports = router;
