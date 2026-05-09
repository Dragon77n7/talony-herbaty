const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDb } = require('./db');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'talony-herbaty-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => console.log(`✅ Talony Herbaty → http://localhost:${PORT}`));
}).catch(e => { console.error('Błąd bazy:', e); process.exit(1); });
