/* migrate-json-to-sqlite.js */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'db', 'shavion.db');
const JSON_PATH = path.join(__dirname, 'data', 'contacts.json');

if (!fs.existsSync(JSON_PATH)) {
  console.log('No contacts.json found, nothing to migrate.');
  process.exit(0);
}

const raw = fs.readFileSync(JSON_PATH, 'utf8');
let arr = [];
try {
  arr = JSON.parse(raw);
} catch(e) {
  console.error('Failed to parse JSON:', e.message);
  process.exit(1);
}

if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// ensure table exists
db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  screenshot TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
`);

const insert = db.prepare(`
  INSERT OR IGNORE INTO contacts (id, name, email, phone, message, screenshot, ip, created_at)
  VALUES (@id, @name, @email, @phone, @message, @screenshot, @ip, @created_at)
`);

let count = 0;
for (const item of arr) {
  const row = {
    id: item.id || require('uuid').v4(),
    name: item.name || '',
    email: item.email || '',
    phone: item.phone || null,
    message: item.message || '',
    screenshot: item.screenshot || null,
    ip: item.ip || null,
    created_at: item.createdAt || item.created_at || new Date().toISOString()
  };
  try {
    insert.run(row);
    count++;
  } catch(err) {
    console.error('Insert failed for', row.id, err.message);
  }
}

console.log('Migrated', count, 'records to', DB_PATH);
db.close();
