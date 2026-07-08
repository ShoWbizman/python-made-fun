// Python Made Fun — tiny sync backend for Railway
// Serves the app (index.html) and stores each family's progress in a JSON file.
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: false }));

// Optional access key. Set env ACCESS_KEY to require a shared family key before
// anyone can open the app. Leave it unset to keep the app open (relies on the
// per-kid codes + Parent PIN only).
const ACCESS_KEY = process.env.ACCESS_KEY || '';
function keyOk(req) {
  if (!ACCESS_KEY) return true;
  const c = req.headers.cookie || '';
  return c.split(';').some(p => p.trim() === 'pmf_key=' + ACCESS_KEY);
}
const GATE_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Python Made Fun</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f2effb;color:#251f3d}
.card{background:#fff;border:1px solid #ece7f8;border-radius:24px;padding:34px 30px;text-align:center;box-shadow:0 12px 34px rgba(80,60,140,.12);width:320px}
h1{font-size:22px;margin:8px 0 4px}p{color:#8a83a6;font-size:14px;margin:0 0 18px}
input{width:100%;box-sizing:border-box;padding:13px;border:2px solid #ece7f8;border-radius:13px;font-size:16px;text-align:center;outline:none}
button{width:100%;margin-top:12px;padding:13px;border:none;border-radius:13px;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;font-size:16px;font-weight:700;cursor:pointer}
.err{color:#c23b3b;font-size:13px;font-weight:700;min-height:18px;margin-top:8px}</style></head>
<body><form class="card" method="POST" action="/gate"><div style="font-size:44px">🐍</div><h1>Python Made Fun</h1>
<p>Enter the family access key to continue.</p>
<input name="key" type="password" placeholder="Access key" autofocus>
<div class="err">__ERR__</div><button type="submit">Enter</button></form></body></html>`;

// Gate every page load (not /api, not /gate). /api is guarded separately below.
app.use((req, res, next) => {
  if (!ACCESS_KEY) return next();
  if (req.path === '/gate' || req.path.startsWith('/api')) return next();
  if (keyOk(req)) return next();
  res.type('html').send(GATE_HTML.replace('__ERR__', req.query.bad ? 'Wrong key — try again' : ''));
});
app.post('/gate', (req, res) => {
  if (ACCESS_KEY && req.body.key === ACCESS_KEY) {
    res.setHeader('Set-Cookie', 'pmf_key=' + ACCESS_KEY + '; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax');
    return res.redirect('/');
  }
  res.redirect('/?bad=1');
});
app.use('/api', (req, res, next) => { if (keyOk(req)) return next(); res.status(401).json({ error: 'locked' }); });

// Where data is stored. On Railway, add a Volume and set DATA_DIR to its mount path
// (e.g. /data) so progress survives redeploys.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'family.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return { accounts: null, progress: {}, sandbox: {} }; }
}
function saveDB(db) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); } catch (e) { console.error('save failed', e); }
}
let db = loadDB();

// --- API ---
app.get('/api/data', (req, res) => res.json(db));

app.put('/api/accounts', (req, res) => { db.accounts = req.body; saveDB(db); res.json({ ok: true }); });

app.put('/api/progress/:id', (req, res) => { db.progress[req.params.id] = req.body; saveDB(db); res.json({ ok: true }); });

app.put('/api/sandbox/:id', (req, res) => { db.sandbox[req.params.id] = req.body; saveDB(db); res.json({ ok: true }); });

app.delete('/api/user/:id', (req, res) => { delete db.progress[req.params.id]; delete db.sandbox[req.params.id]; saveDB(db); res.json({ ok: true }); });

// --- static app ---
app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Python Made Fun running on port ' + PORT));
