const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'eventease.db');
let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('PRAGMA foreign_keys=ON');
    initializeDb();
  }
  return db;
}

function initializeDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emri TEXT NOT NULL,
      mbiemri TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      fjalekalimi TEXT NOT NULL,
      roli TEXT DEFAULT 'pjesemarres' CHECK(roli IN ('pjesemarres','organizator','admin','staf')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulli TEXT NOT NULL,
      pershkrimi TEXT DEFAULT '',
      data TEXT NOT NULL,
      ora TEXT NOT NULL,
      vendndodhja TEXT NOT NULL,
      kapaciteti INTEGER DEFAULT 100,
      organizatori_id INTEGER NOT NULL,
      statusi TEXT DEFAULT 'draft' CHECK(statusi IN ('draft','publikuar','ne_zhvillim','mbyllur')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizatori_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rsvp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      perdorues_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      statusi TEXT DEFAULT 'ne_pritje' CHECK(statusi IN ('ne_pritje','konfirmuar','refuzuar','anuluar')),
      koha_konfirmimit DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(perdorues_id, event_id),
      FOREIGN KEY (perdorues_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS qrcodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kodi_unik TEXT UNIQUE NOT NULL,
      perdorues_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      statusi TEXT DEFAULT 'aktiv' CHECK(statusi IN ('gjeneruar','aktiv','perdorur','pavlefshem')),
      data_gjenerimit DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (perdorues_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      perdorues_id INTEGER NOT NULL,
      lloji TEXT NOT NULL,
      teksti TEXT NOT NULL,
      data_dergimit DATETIME DEFAULT CURRENT_TIMESTAMP,
      lexuar INTEGER DEFAULT 0,
      FOREIGN KEY (perdorues_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create default admin if not exists
  const adminRow = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@eventease.al');
  if (!adminRow) {
    const hashed = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (emri, mbiemri, email, fjalekalimi, roli) VALUES (?,?,?,?,?)').run(
      'Admin', 'EventEase', 'admin@eventease.al', hashed, 'admin'
    );
    console.log('👤 Admin i krijuar: admin@eventease.al / admin123');
  }

  // Demo organizer
  const orgRow = db.prepare('SELECT id FROM users WHERE email = ?').get('org@eventease.al');
  if (!orgRow) {
    const hashed = bcrypt.hashSync('org123', 10);
    db.prepare('INSERT INTO users (emri, mbiemri, email, fjalekalimi, roli) VALUES (?,?,?,?,?)').run(
      'Organi', 'Zator', 'org@eventease.al', hashed, 'organizator'
    );
  }

  // Demo participant
  const partRow = db.prepare('SELECT id FROM users WHERE email = ?').get('user@eventease.al');
  if (!partRow) {
    const hashed = bcrypt.hashSync('user123', 10);
    db.prepare('INSERT INTO users (emri, mbiemri, email, fjalekalimi, roli) VALUES (?,?,?,?,?)').run(
      'Arta', 'Kelmendi', 'user@eventease.al', hashed, 'pjesemarres'
    );
  }

  // Demo events
  const evRow = db.prepare('SELECT id FROM events LIMIT 1').get();
  if (!evRow) {
    const orgId = db.prepare("SELECT id FROM users WHERE roli = 'organizator' LIMIT 1").get();
    if (orgId) {
      db.prepare(`INSERT INTO events (titulli,pershkrimi,data,ora,vendndodhja,kapaciteti,organizatori_id,statusi) VALUES (?,?,?,?,?,?,?,?)`).run(
        'Konferenca Teknologjike 2025',
        'Konferenca vjetore e teknologjisë dhe inovacionit në Shqipëri. Takohemi profesionistët, startup-et dhe entuziastët e teknologjisë.',
        '2025-07-20', '10:00', 'Pallati i Kongreseve, Tiranë', 200, orgId.id, 'publikuar'
      );
      db.prepare(`INSERT INTO events (titulli,pershkrimi,data,ora,vendndodhja,kapaciteti,organizatori_id,statusi) VALUES (?,?,?,?,?,?,?,?)`).run(
        'Festivali i Muzikës Urbane',
        'Festivali vjetor i muzikës urbane me artiste shqiptarë dhe ndërkombëtarë. Tre ditë muzikë, argëtim dhe kulturë.',
        '2025-08-10', '19:00', 'Sheshi Skënderbej, Tiranë', 500, orgId.id, 'publikuar'
      );
      db.prepare(`INSERT INTO events (titulli,pershkrimi,data,ora,vendndodhja,kapaciteti,organizatori_id,statusi) VALUES (?,?,?,?,?,?,?,?)`).run(
        'Workshop: Programim me Python',
        'Workshop praktik për fillestaret në programim me Python. Ndiqni kursin intensiv 2-ditor dhe fitoni certifikatë.',
        '2025-09-05', '09:00', 'Akademia e Shkencave, Tiranë', 50, orgId.id, 'publikuar'
      );
    }
  }
}

module.exports = { getDb };
