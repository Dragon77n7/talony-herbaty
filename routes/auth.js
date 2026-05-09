const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { get, run } = require('../db');

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 3 || password.length < 4)
    return res.json({ ok: false, msg: 'Nazwa min. 3 znaki, hasło min. 4 znaki.' });
  if (username.toLowerCase() === 'admin')
    return res.json({ ok: false, msg: 'Ta nazwa jest zarezerwowana.' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    await run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash]);
    res.json({ ok: true });
  } catch(e) {
    res.json({ ok: false, msg: 'Nazwa użytkownika już zajęta.' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await get(`SELECT * FROM users WHERE username = ?`, [username]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.json({ ok: false, msg: 'Błędna nazwa lub hasło.' });
  req.session.userId = Number(user.id);
  req.session.role = user.role;
  res.json({ ok: true, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = await get(`SELECT id, username, role, tokens FROM users WHERE id = ?`, [req.session.userId]);
  if (!user) return res.json({ loggedIn: false });
  const ts = await get(`SELECT value FROM settings WHERE key='total_tokens'`);
  const tv = await get(`SELECT value FROM settings WHERE key='token_value'`);
  res.json({ loggedIn: true, ...user, total: parseInt(ts.value), value: parseFloat(tv.value) });
});

module.exports = router;
