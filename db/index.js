const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
let db;
async function initDb() {
  db = createClient({ url: process.env.TURSO_URL, authToken: process.env.TURSO_TOKEN });
  await db.executeMultiple(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'user', tokens INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch())); CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS price_history (id INTEGER PRIMARY KEY AUTOINCREMENT, value REAL NOT NULL, ts INTEGER DEFAULT (unixepoch())); CREATE TABLE IF NOT EXISTS token_log (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER, user_id INTEGER, delta INTEGER, note TEXT, ts INTEGER DEFAULT (unixepoch()));`);
  await db.execute(`INSERT OR IGNORE INTO settings (key,value) VALUES ('total_tokens','1000')`);
  await db.execute(`INSERT OR IGNORE INTO settings (key,value) VALUES ('token_value','5.00')`);
  const a = await db.execute(`SELECT id FROM users WHERE username='admin'`);
  if (!a.rows.length) { const hash = require('bcryptjs').hashSync('admin01',10); await db.execute({sql:`INSERT INTO users (username,password,role,tokens) VALUES ('admin',?,'admin',0)`,args:[hash]}); }
  const p = await db.execute(`SELECT id FROM price_history LIMIT 1`);
  if (!p.rows.length) { const v = await db.execute(`SELECT value FROM settings WHERE key='token_value'`); await db.execute({sql:`INSERT INTO price_history (value,ts) VALUES (?,?)`,args:[parseFloat(v.rows[0].value), Math.floor(Date.now()/1000)-3600]}); }
}
async function get(sql,args=[]){const r=await db.execute({sql,args});return r.rows[0]||null;}
async function all(sql,args=[]){const r=await db.execute({sql,args});return r.rows;}
async function run(sql,args=[]){await db.execute({sql,args});}
module.exports={initDb,get,all,run};
