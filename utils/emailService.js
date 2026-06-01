function createNotification(db, userId, lloji, teksti) {
  try {
    db.prepare('INSERT INTO notifications (perdorues_id, lloji, teksti) VALUES (?,?,?)').run(userId, lloji, teksti);
  } catch (err) {
    console.error('Gabim njoftimi:', err.message);
  }
}

module.exports = { createNotification };
