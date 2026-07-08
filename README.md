# Python Made Fun 🐍 — Deploy on Railway

A game-like Python learning app for kids, with a real in-browser Python editor,
stage-gate tests, projects, a PIN-protected Parent Console, and **cross-device
progress sync**.

This folder is everything you need to host it on [Railway](https://railway.app).

## What's in here
- `index.html` — the whole app (self-contained, ~950 KB)
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
