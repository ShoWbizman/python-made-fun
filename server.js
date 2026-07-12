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
  const b = req.body || {};
  const question = String(b.question || '').slice(0, 1000);
  const name = String(b.name || 'friend').slice(0, 40);
  const context = String(b.context || '').slice(0, 2000);
  const history = Array.isArray(b.history) ? b.history.slice(-8).filter(m => m && m.content && (m.role === 'user' || m.role === 'assistant')).map(m => ({ role: m.role, content: String(m.content).slice(0, 1500) })) : [];
  if (!AI_KEY) return res.status(503).json({ error: 'no_ai' });
  if (!question) return res.status(400).json({ error: 'empty' });
  const system = "You are 'Buddy', a warm, patient coding tutor for a child aged 8-12 learning Python. The child's name is " + name + ".\n\n" +
    "HOW TO TEACH:\n" +
    "- Answer the ACTUAL question clearly and in enough detail to truly understand — it's fine to use a few short paragraphs when the topic needs it.\n" +
    "- Explain the WHY, not just the what. Use a simple real-world comparison a kid would get.\n" +
    "- Almost always include a tiny, correct Python example, written on its own lines so it's easy to read.\n" +
    "- If helpful, end with one friendly 'Try this in the Sandbox' idea.\n" +
    "- Break longer answers into short lines and simple steps. Warm, encouraging tone; at most one or two emoji.\n" +
    "- Use vocabulary an 8-12 year old understands; define any big word you use.\n\n" +
    "IMPORTANT: Use the context about what the child is currently learning to tailor your answer and examples to that exact topic. " +
    "If they seem stuck on their current lesson, gently guide them toward the idea WITHOUT just handing over the final answer to the challenge — help them think.\n\n" +
    "SAFETY: Only discuss Python, programming, math, and learning. For anything off-topic or unsafe, kindly say that's one for their grown-up and steer back to code. Never ask for personal information." +
    (context ? ("\n\nCONTEXT — what the child is doing right now:\n" + context) : "");
  const messages = history.concat([{ role: 'user', content: question }]);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 700, system: system, messages: messages })
    });
    if (!r.ok) { const t = await r.text(); console.error('AI error', r.status, t); return res.status(502).json({ error: 'ai_failed' }); }
    const data = await r.json();
    const answer = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
    res.json({ answer: answer });
  } catch (e) { console.error('AI exception', e); res.status(502).json({ error: 'ai_failed' }); }
});

// --- Teach-back grading (the "can teach others" step) ---
// Grades a child's plain-language explanation of a concept. Returns {pass, feedback}.
// Falls back to client-side keyword grading if no AI key.
app.post('/api/teachback', async (req, res) => {
  const b = req.body || {};
  const concept = String(b.concept || '').slice(0, 400);
  const topic = String(b.topic || '').slice(0, 120);
  const answer = String(b.answer || '').slice(0, 1500);
  const name = String(b.name || 'friend').slice(0, 40);
  if (!AI_KEY) return res.status(503).json({ error: 'no_ai' });
  if (!answer) return res.status(400).json({ error: 'empty' });
  const system = "You are 'Buddy', a kind coding teacher grading how well a child (age 8-12) named " + name +
    " explained a Python idea in their OWN words — the 'teach it back' step that proves real understanding.\n" +
    "The topic is: " + topic + ". The question they answered: " + concept + "\n\n" +
    "Be encouraging but honest. PASS them if the explanation is mostly correct and shows they understand the core idea, even if the words are simple or a little messy. FAIL only if it's blank, wrong, or clearly copied without understanding.\n" +
    "Reply ONLY as strict JSON: {\"pass\": true/false, \"feedback\": \"...\"}. " +
    "feedback = 1-3 short, warm sentences: praise what they got right, then ONE thing to add or correct. Speak to the child. At most one emoji. No markdown.";
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 300, system: system, messages: [{ role: 'user', content: answer }] })
    });
    if (!r.ok) { const t = await r.text(); console.error('teachback error', r.status, t); return res.status(502).json({ error: 'ai_failed' }); }
    const data = await r.json();
    const txt = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : '';
    let parsed = null; try { parsed = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)); } catch (e) {}
    if (parsed && typeof parsed.pass === 'boolean') return res.json({ pass: parsed.pass, feedback: String(parsed.feedback || '') });
    return res.status(502).json({ error: 'parse_failed' });
  } catch (e) { console.error('teachback exception', e); res.status(502).json({ error: 'ai_failed' }); }
});

// --- static app ---
app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Python Made Fun running on port ' + PORT));
