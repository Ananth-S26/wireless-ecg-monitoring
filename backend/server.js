const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Register
app.post('/register', (req, res) => {
  const { username, password, full_name } = req.body || {};
  if (!username || !password) return res.status(400).json({ success: false, message: 'Missing fields' });
  const hash = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO doctors (username, password, full_name) VALUES (?, ?, ?)", [username, hash, full_name||null], function(err) {
    if (err) {
      if (String(err.message).includes('UNIQUE')) return res.status(400).json({ success: false, message: 'Username exists' });
      return res.status(500).json({ success: false, message: 'DB error' });
    }
    res.json({ success: true, message: 'Registered' });
  });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ success: false, message: 'Missing fields' });
  db.get("SELECT id, username, password, full_name FROM doctors WHERE username = ?", [username], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: 'DB error' });
    if (!row) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const match = bcrypt.compareSync(password, row.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    res.json({ success: true, user: { id: row.id, username: row.username, full_name: row.full_name } });
  });
});

// Save patient ECG (expects { name, ecg_data: [numbers] })
app.post('/patients', (req, res) => {
  const { name, ecg_data } = req.body || {};
  if (!name || !Array.isArray(ecg_data) || ecg_data.length === 0) return res.status(400).json({ success: false, message: 'Invalid payload' });
  const jsonStr = JSON.stringify(ecg_data);
  db.run("INSERT INTO patients (name, ecg_data) VALUES (?, ?)", [name, jsonStr], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'DB insert error' });
    res.json({ success: true, patientId: this.lastID });
  });
});

// Get patients with optional filters: ?name=&start=&end=
app.get('/patients', (req, res) => {
  const { name, start, end } = req.query || {};
  let where = [];
  let params = [];
  if (name) { where.push("name LIKE ?"); params.push(`%${name}%`); }
  if (start) { where.push("date(created_at) >= date(?)"); params.push(start); }
  if (end) { where.push("date(created_at) <= date(?)"); params.push(end); }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT id, name, ecg_data, created_at FROM patients ${whereClause} ORDER BY created_at DESC`;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'DB fetch error' });
    res.json(rows);
  });
});


// --------- UPDATED SERVER LISTEN PART ---------
const START_PORT = process.env.PORT || 5000;

function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`✅ ECG backend running at http://localhost:${port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️ Port ${port} already in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error("❌ Server error:", err);
    }
  });
}

startServer(Number(START_PORT));
