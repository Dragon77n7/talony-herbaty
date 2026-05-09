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

router.get('/stats', (req, res) => {
  const total = parseInt(get(`SELECT value FROM settings WHERE key='total_tokens'`).value);
  const value = parseFloat(get(`SELECT value FROM settings WHERE key='token_value'`).value);
  const users = get(`SELECT COUNT(*) as c FROM users WHERE role != 'admin'`).c;
  res.json({ total, value, users });
});

router.get('/history', (req, res) => {
  const gran = req.query.gran || 'day';
  let divisor;
  if (gran === 'week')        divisor = 604800;
  else if (gran === 'day')    divisor = 86400;
  else if (gran === 'hour')   divisor = 3600;
  else                        divisor = 60;   // minute

  const rows = all(`SELECT value, ts FROM price_history ORDER BY ts ASC`);
  const buckets = {};
  rows.forEach(r => {
    const bucket = Math.floor(r.ts / divisor);
    if (!buckets[bucket]) {
      buckets[bucket] = { open_val: r.value, max_val: r.value, min_val: r.value, close_val: r.value, open_ts: r.ts, bucket };
    } else {
      const b = buckets[bucket];
      b.close_val = r.value;
      if (r.value > b.max_val) b.max_val = r.value;
      if (r.value < b.min_val) b.min_val = r.value;
    }
  });
  const result = Object.values(buckets).sort((a,b) => a.bucket - b.bucket);
  res.json(result);
});

router.get('/my-tokens', requireLogin, (req, res) => {
  const user = get(`SELECT tokens FROM users WHERE id = ?`, [req.session.userId]);
  const total = parseInt(get(`SELECT value FROM settings WHERE key='total_tokens'`).value);
  const value = parseFloat(get(`SELECT value FROM settings WHERE key='token_value'`).value);
  res.json({ tokens: user.tokens, total, value, pct: total > 0 ? (user.tokens / total * 100).toFixed(2) : '0.00' });
});

router.get('/admin/users', requireAdmin, (req, res) => {
  const users = all(`SELECT id, username, role, tokens, created_at FROM users WHERE role != 'admin' ORDER BY username`);
  res.json(users);
});

router.post('/admin/set-tokens', requireAdmin, (req, res) => {
  let { userId, delta, note } = req.body;
  userId = parseInt(userId); delta = parseInt(delta);
  const user = get(`SELECT * FROM users WHERE id = ? AND role != 'admin'`, [userId]);
  if (!user) return res.json({ ok: false, msg: 'Użytkownik nie istnieje.' });
  const newVal = Math.max(0, user.tokens + delta);
  run(`UPDATE users SET tokens = ? WHERE id = ?`, [newVal, userId]);
  run(`INSERT INTO token_log (admin_id, user_id, delta, note) VALUES (?,?,?,?)`, [req.session.userId, userId, delta, note || '']);
  res.json({ ok: true, newVal });
});

router.post('/admin/set-total', requireAdmin, (req, res) => {
  const val = parseInt(req.body.total);
  if (isNaN(val) || val < 0) return res.json({ ok: false, msg: 'Nieprawidłowa wartość.' });
  run(`UPDATE settings SET value = ? WHERE key = 'total_tokens'`, [String(val)]);
  res.json({ ok: true });
});

router.post('/admin/set-value', requireAdmin, (req, res) => {
  const val = parseFloat(req.body.value);
  if (isNaN(val) || val < 0) return res.json({ ok: false, msg: 'Nieprawidłowa wartość.' });
  run(`UPDATE settings SET value = ? WHERE key = 'token_value'`, [String(val)]);
  const ts = Math.floor(Date.now()/1000);
  run(`INSERT INTO price_history (value, ts) VALUES (?, ?)`, [val, ts]);
  res.json({ ok: true });
});

router.get('/admin/log', requireAdmin, (req, res) => {
  const rows = all(`
    SELECT l.id, l.delta, l.note, l.ts, u.username as target_name
    FROM token_log l
    LEFT JOIN users u ON u.id = l.user_id
    ORDER BY l.ts DESC LIMIT 100
  `);
  res.json(rows);
});

module.exports = router;
