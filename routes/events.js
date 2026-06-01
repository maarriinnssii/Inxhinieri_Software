const express = require('express');
const { getDb } = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/events — all published events
router.get('/', (req, res) => {
  const db = getDb();
  const events = db.prepare(`
    SELECT e.*,
      u.emri || ' ' || u.mbiemri AS organizatori_emri,
      (SELECT COUNT(*) FROM rsvp WHERE event_id = e.id AND statusi = 'konfirmuar') AS pjesemarres_konfirmuar
    FROM events e
    JOIN users u ON e.organizatori_id = u.id
    WHERE e.statusi = 'publikuar'
    ORDER BY e.data ASC
  `).all();
  res.json(events);
});

// GET /api/events/my — organizer's own events
router.get('/my', authMiddleware, requireRole(['organizator', 'admin']), (req, res) => {
  const db = getDb();
  const id = req.user.roli === 'admin' ? null : req.user.id;
  const events = db.prepare(`
    SELECT e.*,
      u.emri || ' ' || u.mbiemri AS organizatori_emri,
      (SELECT COUNT(*) FROM rsvp WHERE event_id = e.id AND statusi = 'konfirmuar') AS pjesemarres_konfirmuar,
      (SELECT COUNT(*) FROM rsvp WHERE event_id = e.id) AS total_rsvp
    FROM events e
    JOIN users u ON e.organizatori_id = u.id
    ${id ? 'WHERE e.organizatori_id = ?' : ''}
    ORDER BY e.created_at DESC
  `).all(...(id ? [id] : []));
  res.json(events);
});

// GET /api/events/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const event = db.prepare(`
    SELECT e.*,
      u.emri || ' ' || u.mbiemri AS organizatori_emri,
      (SELECT COUNT(*) FROM rsvp WHERE event_id = e.id AND statusi = 'konfirmuar') AS pjesemarres_konfirmuar
    FROM events e
    JOIN users u ON e.organizatori_id = u.id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Eventi nuk u gjet.' });
  res.json(event);
});

// POST /api/events — create event
router.post('/', authMiddleware, requireRole(['organizator', 'admin']), (req, res) => {
  const { titulli, pershkrimi, data, ora, vendndodhja, kapaciteti } = req.body;
  if (!titulli || !data || !ora || !vendndodhja) {
    return res.status(400).json({ error: 'Titulli, data, ora dhe vendndodhja janë të detyrueshme.' });
  }
  const { statusi } = req.body;
  const validStatusi = ['draft', 'publikuar', 'ne_zhvillim', 'mbyllur'].includes(statusi) ? statusi : 'draft';
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO events (titulli, pershkrimi, data, ora, vendndodhja, kapaciteti, organizatori_id, statusi) VALUES (?,?,?,?,?,?,?,?)'
  ).run(titulli, pershkrimi || '', data, ora, vendndodhja, kapaciteti || 100, req.user.id, validStatusi);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ event, message: 'Eventi u krijua me sukses!' });
});

// PUT /api/events/:id — update event
router.put('/:id', authMiddleware, requireRole(['organizator', 'admin']), (req, res) => {
  const db = getDb();
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Eventi nuk u gjet.' });
  if (event.organizatori_id !== req.user.id && req.user.roli !== 'admin') {
    return res.status(403).json({ error: 'Nuk keni leje për të ndryshuar këtë event.' });
  }

  const { titulli, pershkrimi, data, ora, vendndodhja, kapaciteti, statusi } = req.body;
  db.prepare(`
    UPDATE events SET
      titulli = COALESCE(?, titulli),
      pershkrimi = COALESCE(?, pershkrimi),
      data = COALESCE(?, data),
      ora = COALESCE(?, ora),
      vendndodhja = COALESCE(?, vendndodhja),
      kapaciteti = COALESCE(?, kapaciteti),
      statusi = COALESCE(?, statusi)
    WHERE id = ?
  `).run(titulli, pershkrimi, data, ora, vendndodhja, kapaciteti, statusi, req.params.id);

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  res.json({ event: updated, message: 'Eventi u përditësua me sukses!' });
});

// DELETE /api/events/:id
router.delete('/:id', authMiddleware, requireRole(['organizator', 'admin']), (req, res) => {
  const db = getDb();
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Eventi nuk u gjet.' });
  if (event.organizatori_id !== req.user.id && req.user.roli !== 'admin') {
    return res.status(403).json({ error: 'Nuk keni leje për të fshirë këtë event.' });
  }
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.json({ message: 'Eventi u fshi me sukses!' });
});

// GET /api/events/:id/participants
router.get('/:id/participants', authMiddleware, requireRole(['organizator', 'admin', 'staf']), (req, res) => {
  const db = getDb();
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Eventi nuk u gjet.' });

  if (req.user.roli === 'organizator' && event.organizatori_id !== req.user.id) {
    return res.status(403).json({ error: 'Nuk keni akses.' });
  }

  const participants = db.prepare(`
    SELECT r.id AS rsvp_id, r.statusi AS rsvp_statusi, r.koha_konfirmimit, r.created_at AS rsvp_date,
      u.id AS user_id, u.emri, u.mbiemri, u.email,
      q.kodi_unik, q.statusi AS qr_statusi, q.data_gjenerimit
    FROM rsvp r
    JOIN users u ON r.perdorues_id = u.id
    LEFT JOIN qrcodes q ON q.perdorues_id = u.id AND q.event_id = r.event_id
    WHERE r.event_id = ?
    ORDER BY r.created_at DESC
  `).all(req.params.id);

  res.json(participants);
});

module.exports = router;
