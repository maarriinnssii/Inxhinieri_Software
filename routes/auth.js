const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'eventease_secret_key_2024';

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { emri, mbiemri, email, fjalekalimi, roli } = req.body;

  if (!emri || !mbiemri || !email || !fjalekalimi) {
    return res.status(400).json({ error: 'Të gjitha fushat janë të detyrueshme.' });
  }
  if (fjalekalimi.length < 6) {
    return res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Ky email është tashmë i regjistruar.' });

  const validRoli = ['pjesemarres', 'organizator', 'staf'].includes(roli) ? roli : 'pjesemarres';
  const hashed = bcrypt.hashSync(fjalekalimi, 10);

  const result = db.prepare(
    'INSERT INTO users (emri, mbiemri, email, fjalekalimi, roli) VALUES (?,?,?,?,?)'
  ).run(emri, mbiemri, email, hashed, validRoli);

  const user = db.prepare('SELECT id, emri, mbiemri, email, roli FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = jwt.sign({ id: user.id, email: user.email, roli: user.roli }, JWT_SECRET, { expiresIn: '24h' });

  res.status(201).json({ user, token, message: 'Regjistrimi u krye me sukses! Mirë se vini!' });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, fjalekalimi } = req.body;
  if (!email || !fjalekalimi) return res.status(400).json({ error: 'Email-i dhe fjalëkalimi janë të detyrueshme.' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(fjalekalimi, user.fjalekalimi)) {
    return res.status(401).json({ error: 'Email-i ose fjalëkalimi është i gabuar.' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, roli: user.roli }, JWT_SECRET, { expiresIn: '24h' });
  const { fjalekalimi: _, ...safeUser } = user;
  res.json({ user: safeUser, token, message: 'Hyrja u krye me sukses!' });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, emri, mbiemri, email, roli, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Përdoruesi nuk u gjet.' });
  res.json(user);
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req, res) => {
  const { emri, mbiemri, fjalekalimi_ri } = req.body;
  const db = getDb();

  if (fjalekalimi_ri && fjalekalimi_ri.length >= 6) {
    const hashed = bcrypt.hashSync(fjalekalimi_ri, 10);
    db.prepare('UPDATE users SET emri=?, mbiemri=?, fjalekalimi=? WHERE id=?').run(emri, mbiemri, hashed, req.user.id);
  } else {
    db.prepare('UPDATE users SET emri=?, mbiemri=? WHERE id=?').run(emri, mbiemri, req.user.id);
  }

  const updated = db.prepare('SELECT id, emri, mbiemri, email, roli FROM users WHERE id=?').get(req.user.id);
  res.json({ user: updated, message: 'Profili u përditësua me sukses!' });
});

module.exports = router;
