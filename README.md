# Python Made Fun 🐍 — Deploy on Railway

A game-like Python learning app for kids, with a real in-browser Python editor,
stage-gate tests, projects, a PIN-protected Parent Console, and **cross-device
progress sync**.

This folder is everything you need to host it on [Railway](https://railway.app).

## The learning path (beginner → master)
19 worlds, each with lessons + a stage-gate test, plus a Project Workshop.
**Every lesson is a 5-step mastery loop — not a quick fill-in:**
1. 📖 Learn the concept. 2. 🔮 Predict what code prints (read before you run). 3. 🐛 Fix a bug. 4. 🔨 Build it yourself. 5. 🎓 Teach it back in your own words — Buddy (AI) grades the explanation and coaches. A lesson only counts as *mastered* when all steps are done.

1–9 (Basics): print, variables & input, math, if/else, loops, lists, dictionaries, functions, and a game-building capstone.
10–18 (Advanced): f-strings & string methods, advanced loops, comprehensions, tuples/sets, advanced functions, errors, OOP, libraries/JSON, algorithms. 19: Master's Summit.

**Beyond lessons — the mastery extras:**
- **Stage-gate tests** now mix multiple-choice + predict-the-output + write-real-code questions, need **85%** to pass, and give a **speed bonus** (+30 XP) for beating the clock.
- **🧠 Brain Gym** on the home map: a **Daily Challenge** (rotates daily, keeps the streak alive), **Review Checkpoints** that remix questions from earlier worlds, **Teacher Mode** (he writes his own quiz questions — shared to the Parent Console), and a **Cheat Sheet** of quick notes for every world.
- **Per-world mastery score** (🧠 %) shows *understood*, not just *done*.
10–18 (Advanced): f-strings & string methods, advanced loops (break/continue/enumerate), list & dict comprehensions, tuples/sets/nested data, advanced functions (defaults, *args, recursion), errors (try/except/raise), object-oriented classes & inheritance, libraries & JSON, and algorithms (search/sort/count).
19 (Master's Summit): combine everything into real programs.
Projects unlock as worlds are cleared — from a Greeting Bot up to a class-based Virtual Pet.

## What's in here
- `index.html` — the whole app (self-contained, ~1 MB)
- `server.js` — a tiny Node/Express server that serves the app and stores progress
- `package.json` — dependencies + start script

## Deploy in ~5 minutes

### Option A — from GitHub (recommended)
1. Put these three files in a GitHub repo (keep them at the repo root, or in a folder — just make sure `index.html`, `server.js`, `package.json` sit together).
2. Go to **railway.app → New Project → Deploy from GitHub repo** and pick the repo.
3. Railway auto-detects Node and runs `npm install` then `npm start`.
4. Open **Settings → Networking → Generate Domain**. That URL is the link you share. 🎉

### Option B — Railway CLI
```bash
npm i -g @railway/cli
railway login
railway init
railway up          # from inside this folder
railway domain      # creates your public URL
```

## Make progress survive redeploys (important)
Railway's default disk is wiped on each deploy. To keep everyone's progress:
1. In your service: **Variables → New Volume** (or **Data → Add Volume**).
2. Mount it at `/data`.
3. Add an environment variable: `DATA_DIR = /data`.

Now all profiles + progress are saved on the volume and persist across deploys.
(Progress lives in `/data/family.json` — you can download it as a backup anytime.)

## Optional: lock the URL with an access key
If you want the link to be safe to share more widely, add an environment variable:

- `ACCESS_KEY` = any secret word/phrase you choose (e.g. `dosa-rocket-42`)

When set, anyone opening the URL sees a one-time "Enter the family access key"
screen before the app loads. Enter it once per device and you're in (it's
remembered with a cookie). Leave `ACCESS_KEY` unset to keep the app open and rely
only on the per-kid codes + Parent PIN. This is light, family-grade protection —
not bank-grade security.

## Ask Buddy — the in-app AI tutor (optional)
The Help & Buddy screen lets a learner ask coding questions and get kid-friendly
answers. To turn on real AI answers, add an environment variable on Railway:

- `ANTHROPIC_API_KEY` = your Anthropic API key (from console.anthropic.com)
- (optional) `ANTHROPIC_MODEL` = defaults to `claude-3-5-haiku-latest`

The server proxies questions with a strict kid-safe, Python-only tutor prompt, and
every question a child asks is also copied into the parent's **Messages &
Questions** thread so you can see what they're learning. **Without** the key, the
app still works — Ask Buddy falls back to answering from the built-in Word Book,
and messaging your grown-up still works normally.

## Backup & restore
Open the **Parent Console → 💾 Backup & Restore**:
- **Download backup** saves every profile + all progress to a `.json` file.
- **Restore from file** loads a backup back in (and re-syncs it to the server).
Handy before big changes, or to seed a brand-new deployment.

## How sync works
- When the app is opened from your Railway URL, it automatically talks to `/api`
  on the same server. Every profile's progress is saved to the server and pulled
  back on any device — so your kid can start on the tablet and continue on the
  laptop, and it all shows up in your Parent Console.
- If the app is opened as a plain file with no server (e.g. offline), it quietly
  falls back to saving on that one device. No errors, just no sync.
- Sync refreshes every ~15 seconds and whenever a device's tab regains focus.

## Sharing with your kids
Send them the Railway domain (e.g. `https://python-made-fun.up.railway.app`).
Each child logs in with only their own **4-digit secret code**; they never see
each other's profiles. You reach the **Parent Console** with the grown-up button
+ your PIN, where you can add kids, see/change their codes, and view reports.

Default starter codes (change them in the Parent Console):
- Player 1 (kid): **1234**
- Parent (your own learning profile): **1000**
- Parent Console PIN: you set it the first time you open the console.

## Notes
- The Python engine loads from a public CDN, so devices need internet.
- This is a family-scale app: the server keeps one shared family dataset. If you
  want per-family separation on a public host, ask and we can add an access key.
