const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'ecg.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    full_name TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    ecg_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  // seed default doctor if not exists (username: doctor, password: 1234)
  db.get("SELECT 1 FROM doctors WHERE username = ?", ['doctor'], (err, row) => {
    if (!row) {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('1234', 10);
      db.run("INSERT INTO doctors (username, password, full_name) VALUES (?, ?, ?)", ['doctor', hash, 'Demo Doctor']);
    }
  });
});

module.exports = db;
