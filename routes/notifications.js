const express = require('express');
const { getDb } = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications
router.get('/', authMiddleware, (req, res) => {
  const db = getDb();
  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE perdorues_id = ? ORDER BY data_dergimit DESC LIMIT 30'
  ).all(req.user.id);
  res.json(notifications);
});

// GET /api/notifications/unread-count
router.get('/unread-count', authMiddleware, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM notifications WHERE perdorues_id = ? AND lexuar = 0').get(req.user.id);
  res.json({ count: row.cnt });
});

// PUT /api/notifications/read-all
router.put('/read-all', authMiddleware, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE notifications SET lexuar = 1 WHERE perdorues_id = ?').run(req.user.id);
  res.json({ message: 'Njoftimet u shënuan si të lexuara.' });
});

module.exports = router;
