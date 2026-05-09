const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { get, run, all } = require('../db');

router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 3 || password.length < 4)
    return res.json({ ok: false, msg: 'Nazwa min. 3 znaki, hasło min. 4 znaki.' });
  if (username.toLowerCase() === 'admin')
    return res.json({ ok: false, msg: 'Ta nazwa jest zarezerwowana.' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash]);
    res.json({ ok: true });
  } catch(e) {
    res.json({ ok: false, msg: 'Nazwa użytkownika już zajęta.' });
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = get(`SELECT * FROM users WHERE username = ?`, [username]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.json({ ok: false, msg: 'Błędna nazwa lub hasło.' });
  req.session.userId = user.id;
  req.session.role = user.role;
  res.json({ ok: true, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = get(`SELECT id, username, role, tokens FROM users WHERE id = ?`, [req.session.userId]);
  if (!user) return res.json({ loggedIn: false });
  const total = parseInt(get(`SELECT value FROM settings WHERE key='total_tokens'`).value);
  const value = parseFloat(get(`SELECT value FROM settings WHERE key='token_value'`).value);
  res.json({ loggedIn: true, ...user, total, value });
});

module.exports = router;
