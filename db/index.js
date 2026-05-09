const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'talony.db.bin');
let db = null;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      tokens INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value REAL NOT NULL,
      ts INTEGER DEFAULT (strftime('%s','now'))
    );
    CREATE TABLE IF NOT EXISTS token_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER, user_id INTEGER, delta INTEGER, note TEXT,
      ts INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  db.run(`INSERT OR IGNORE INTO settings (key,value) VALUES ('total_tokens','1000')`);
  db.run(`INSERT OR IGNORE INTO settings (key,value) VALUES ('token_value','5.00')`);

  const adminRows = db.exec(`SELECT id FROM users WHERE username='admin'`);
  if (!adminRows.length || !adminRows[0].values.length) {
    const hash = bcrypt.hashSync('admin01', 10);
    db.run(`INSERT INTO users (username,password,role,tokens) VALUES ('admin',?,'admin',0)`, [hash]);
  }

  const ph = db.exec(`SELECT id FROM price_history LIMIT 1`);
  if (!ph.length || !ph[0].values.length) {
    const val = parseFloat(db.exec(`SELECT value FROM settings WHERE key='token_value'`)[0].values[0][0]);
    const ts = Math.floor(Date.now()/1000) - 3600;
    db.run(`INSERT INTO price_history (value,ts) VALUES (?,?)`, [val, ts]);
  }

  saveDb();
}

function get(sql, params=[]) {
  const rows = db.exec(sql, params);
  if (!rows.length || !rows[0].values.length) return null;
  const obj = {};
  rows[0].columns.forEach((c,i) => obj[c] = rows[0].values[0][i]);
  return obj;
}

function all(sql, params=[]) {
  const rows = db.exec(sql, params);
  if (!rows.length) return [];
  return rows[0].values.map(vals => {
    const obj = {};
    rows[0].columns.forEach((c,i) => obj[c] = vals[i]);
    return obj;
  });
}

function run(sql, params=[]) {
  db.run(sql, params);
  saveDb();
}

module.exports = { initDb, get, all, run };
