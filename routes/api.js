const router = require('express').Router();
const { get, all, run } = require('../db');

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ ok: false, msg: 'Wymagane logowanie.' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') return res.status(403).json({ ok: false, msg: 'Brak uprawnień.' });
  next();
}

router.get('/stats', async (req, res) => {
  const total = await get(`SELECT value FROM settings WHERE key='total_tokens'`);
  const value = await get(`SELECT value FROM settings WHERE key='token_value'`);
  const users = await get(`SELECT COUNT(*) as c FROM users WHERE role != 'admin'`);
  res.json({ total: parseInt(total.value), value: parseFloat(value.value), users: Number(users.c) });
});

router.get('/history', async (req, res) => {
  const gran = req.query.gran || 'day';
  let divisor;
  if (gran === 'week') divisor = 604800;
  else if (gran === 'day') divisor = 86400;
  else if (gran === 'hour') divisor = 3600;
  else divisor = 60;

  const rows = await all(`SELECT value, ts FROM price_history ORDER BY ts ASC`);
  const buckets = {};
  rows.forEach(r => {
    const v = parseFloat(r.value), t = Number(r.ts);
    const bucket = Math.floor(t / divisor);
    if (!buckets[bucket]) buckets[bucket] = { open_val:v, max_val:v, min_val:v, close_val:v, open_ts:t, bucket };
    else { const b=buckets[bucket]; b.close_val=v; if(v>b.max_val)b.max_val=v; if(v<b.min_val)b.min_val=v; }
  });
  res.json(Object.values(buckets).sort((a,b)=>a.bucket-b.bucket));
});

router.get('/my-tokens', requireLogin, async (req, res) => {
  const user = await get(`SELECT tokens FROM users WHERE id = ?`, [req.session.userId]);
  const total = await get(`SELECT value FROM settings WHERE key='total_tokens'`);
  const value = await get(`SELECT value FROM settings WHERE key='token_value'`);
  const t = parseInt(total.value), v = parseFloat(value.value), tok = Number(user.tokens);
  res.json({ tokens: tok, total: t, value: v, pct: t > 0 ? (tok/t*100).toFixed(2) : '0.00' });
});

router.get('/admin/users', requireAdmin, async (req, res) => {
  const users = await all(`SELECT id, username, role, tokens, created_at FROM users WHERE role != 'admin' ORDER BY username`);
  res.json(users);
});

router.post('/admin/set-tokens', requireAdmin, async (req, res) => {
  let { userId, delta, note } = req.body;
  userId = parseInt(userId); delta = parseInt(delta);
  const user = await get(`SELECT * FROM users WHERE id = ? AND role != 'admin'`, [userId]);
  if (!user) return res.json({ ok: false, msg: 'Użytkownik nie istnieje.' });
  const newVal = Math.max(0, Number(user.tokens) + delta);
  await run(`UPDATE users SET tokens = ? WHERE id = ?`, [newVal, userId]);
  await run(`INSERT INTO token_log (admin_id, user_id, delta, note) VALUES (?,?,?,?)`, [req.session.userId, userId, delta, note||'']);
  res.json({ ok: true, newVal });
});

router.post('/admin/set-total', requireAdmin, async (req, res) => {
  const val = parseInt(req.body.total);
  if (isNaN(val) || val < 0) return res.json({ ok: false, msg: 'Nieprawidłowa wartość.' });
  await run(`UPDATE settings SET value = ? WHERE key = 'total_tokens'`, [String(val)]);
  res.json({ ok: true });
});

router.post('/admin/set-value', requireAdmin, async (req, res) => {
  const val = parseFloat(req.body.value);
  if (isNaN(val) || val < 0) return res.json({ ok: false, msg: 'Nieprawidłowa wartość.' });
  await run(`UPDATE settings SET value = ? WHERE key = 'token_value'`, [String(val)]);
  const ts = Math.floor(Date.now()/1000);
  await run(`INSERT INTO price_history (value, ts) VALUES (?, ?)`, [val, ts]);
  res.json({ ok: true });
});

router.get('/admin/log', requireAdmin, async (req, res) => {
  const rows = await all(`
    SELECT l.id, l.delta, l.note, l.ts, u.username as target_name
    FROM token_log l LEFT JOIN users u ON u.id = l.user_id
    ORDER BY l.ts DESC LIMIT 100
  `);
  res.json(rows);
});

module.exports = router;
