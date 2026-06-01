const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database (creates tables + default admin)
require('./database/db');

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/rsvp', require('./routes/rsvp'));
app.use('/api/qr', require('./routes/qrcode'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));

app.listen(PORT, () => {
  console.log(`\n✅ EventEase server po ekzekutohet në port ${PORT}`);
  console.log(`🌐 Vizito: http://localhost:${PORT}`);
  console.log(`👤 Admin: admin@eventease.al / admin123\n`);
});
