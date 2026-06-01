const express = require('express');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { createNotification } = require('../utils/emailService');

const router = express.Router();

// POST /api/qr/generate — generate QR for confirmed RSVP
router.post('/generate', authMiddleware, async (req, res) => {
  const { event_id } = req.body;
  const db = getDb();

  const rsvp = db.prepare(
    "SELECT * FROM rsvp WHERE perdorues_id = ? AND event_id = ? AND statusi = 'konfirmuar'"
  ).get(req.user.id, event_id);

  if (!rsvp) {
    return res.status(400).json({ error: 'Duhet të konfirmoni pjesëmarrjen për të marrë kodin QR.' });
  }

  // Return existing active QR if already generated
  const existing = db.prepare(
    "SELECT * FROM qrcodes WHERE perdorues_id = ? AND event_id = ? AND statusi != 'pavlefshem'"
  ).get(req.user.id, event_id);

  if (existing) {
    const qrData = JSON.stringify({ kodi: existing.kodi_unik, event_id, user_id: req.user.id });
    const qrImage = await QRCode.toDataURL(qrData, { errorCorrectionLevel: 'H', width: 300 });
    return res.json({ qrCode: qrImage, kodi_unik: existing.kodi_unik, statusi: existing.statusi });
  }

  // Generate new QR
  const kodiUnik = uuidv4();
  const qrData = JSON.stringify({ kodi: kodiUnik, event_id, user_id: req.user.id });

  db.prepare('INSERT INTO qrcodes (kodi_unik, perdorues_id, event_id, statusi) VALUES (?,?,?,?)').run(
    kodiUnik, req.user.id, event_id, 'aktiv'
  );

  const qrImage = await QRCode.toDataURL(qrData, { errorCorrectionLevel: 'H', width: 300 });

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(event_id);
  createNotification(db, req.user.id, 'qr_gjeneruar',
    `Regjistrimi u krye me sukses. Ky është kodi juaj QR për hyrje në eventin "${event.titulli}".`);

  res.json({
    qrCode: qrImage,
    kodi_unik: kodiUnik,
    statusi: 'aktiv',
    message: 'Regjistrimi u krye me sukses. Ky është kodi juaj QR për hyrje në event.'
  });
});

// POST /api/qr/verify — verify QR at event entry
router.post('/verify', authMiddleware, requireRole(['staf', 'organizator', 'admin']), (req, res) => {
  const { kodi_unik } = req.body;
  if (!kodi_unik) return res.status(400).json({ valid: false, message: 'Kodi QR mungon.' });

  const db = getDb();
  const qr = db.prepare(`
    SELECT q.*, u.emri, u.mbiemri, u.email, e.titulli AS event_titulli, e.data AS event_data
    FROM qrcodes q
    JOIN users u ON q.perdorues_id = u.id
    JOIN events e ON q.event_id = e.id
    WHERE q.kodi_unik = ?
  `).get(kodi_unik);

  if (!qr) return res.json({ valid: false, message: 'Kodi QR nuk është i vlefshëm.' });
  if (qr.statusi === 'perdorur') return res.json({ valid: false, message: 'Ky kod QR është përdorur tashmë.' });
  if (qr.statusi === 'pavlefshem') return res.json({ valid: false, message: 'Kodi QR ka skaduar. Kontaktoni organizatorin.' });

  db.prepare("UPDATE qrcodes SET statusi = 'perdorur' WHERE kodi_unik = ?").run(kodi_unik);

  res.json({
    valid: true,
    message: 'Hyrja u krye me sukses!',
    perdorues: { emri: qr.emri, mbiemri: qr.mbiemri, email: qr.email },
    event: { titulli: qr.event_titulli, data: qr.event_data }
  });
});

// GET /api/qr/my — user's own QR codes
router.get('/my', authMiddleware, (req, res) => {
  const db = getDb();
  const qrcodes = db.prepare(`
    SELECT q.*, e.titulli, e.data, e.ora, e.vendndodhja
    FROM qrcodes q
    JOIN events e ON q.event_id = e.id
    WHERE q.perdorues_id = ?
    ORDER BY q.data_gjenerimit DESC
  `).all(req.user.id);
  res.json(qrcodes);
});

module.exports = router;
