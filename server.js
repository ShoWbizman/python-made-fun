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
  try { const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); if (!d.messages) d.messages = {}; return d; }
  catch (e) { return { accounts: null, progress: {}, sandbox: {}, messages: {} }; }
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

app.delete('/api/user/:id', (req, res) => { delete db.progress[req.params.id]; delete db.sandbox[req.params.id]; delete db.messages[req.params.id]; saveDB(db); res.json({ ok: true }); });

// --- messages (learner <-> parent) ---
// Append one message to a learner's thread.
app.post('/api/messages/:id', (req, res) => {
  if (!db.messages) db.messages = {};
  if (!db.messages[req.params.id]) db.messages[req.params.id] = [];
  db.messages[req.params.id].push(req.body);
  if (db.messages[req.params.id].length > 400) db.messages[req.params.id] = db.messages[req.params.id].slice(-400);
  saveDB(db); res.json({ ok: true });
});
// Replace a learner's whole thread (used for marking messages read).
app.put('/api/messages/:id', (req, res) => { if (!db.messages) db.messages = {}; db.messages[req.params.id] = req.body; saveDB(db); res.json({ ok: true }); });

// --- Ask Buddy (AI tutor) ---
// Proxies to Anthropic if ANTHROPIC_API_KEY is set. Kid-safe, Python-focused.
// If no key is configured, returns 503 and the app falls back to its built-in
// Word Book answers so nothing breaks.
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';
app.post('/api/ask', async (req, res) => {
  const question = String((req.body && req.body.question) || '').slice(0, 500);
  const name = String((req.body && req.body.name) || 'friend').slice(0, 40);
  if (!AI_KEY) return res.status(503).json({ error: 'no_ai' });
  if (!question) return res.status(400).json({ error: 'empty' });
  const system = "You are 'Buddy', a warm, encouraging coding tutor for a child aged 8-12 who is learning Python. " +
    "Rules: keep answers SHORT (2-5 sentences), use simple kid-friendly words, be cheerful and use at most one emoji. " +
    "Give tiny Python examples when helpful, wrapped in plain text. Only talk about Python and learning to code; " +
    "if asked about anything unsafe or off-topic, gently steer back to coding and suggest they ask their grown-up. " +
    "Never ask for or repeat personal information. The child's name is " + name + ".";
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 400, system: system, messages: [{ role: 'user', content: question }] })
    });
    if (!r.ok) { const t = await r.text(); console.error('AI error', r.status, t); return res.status(502).json({ error: 'ai_failed' }); }
    const data = await r.json();
    const answer = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
    res.json({ answer: answer });
  } catch (e) { console.error('AI exception', e); res.status(502).json({ error: 'ai_failed' }); }
});

// --- static app ---
app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Python Made Fun running on port ' + PORT));
