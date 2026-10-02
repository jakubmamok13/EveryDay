# EveryDay — your personal cycling coach

EveryDay runs on **your own Windows PC**. Every morning it sends one
notification to your phone. You do a 10-second check-in (sleep, legs,
motivation, indoors or outdoors). The coach then adjusts today's workout to
how your body is doing and sends it to **MyWhoosh** (indoors) or to the
**BOLT and Fenix** (outdoors) through intervals.icu.

- Plan: 4-week blocks to raise FTP plus a build-up to 200 km rides (Allen & Coggan method).
- Readiness: HRV, resting heart rate, sleep, Body Battery, Garmin readiness, training load, check-in.
- Coach: short morning brief and chat in Polish, written by a **local AI** (Ollama) on your PC.
  Without the AI it still works, with fixed sentence templates.
- Your data never leaves your PC, except to intervals.icu.

The full plan is in [`docs/`](docs/00_index.md).

---

## 1. What you need

| Item | Where |
|---|---|
| Windows PC that stays on | your RX 7800 XT PC |
| **Node.js 24 LTS** (or 22.13+) | https://nodejs.org → "LTS" installer |
| **Git** (optional, makes updates easy) | https://git-scm.com |
| **Ollama for Windows** (the local AI) | https://ollama.com/download |
| **Tailscale** on the PC **and** the phone | https://tailscale.com/download |
| intervals.icu account with Garmin, MyWhoosh, Wahoo linked | already done ✔ |

## 2. Install (one time, about 15 minutes)

Open **PowerShell** and run, one line at a time:

```powershell
cd C:\
git clone https://github.com/jakubmamok13/EveryDay
cd EveryDay
npm install
npm run build
```

(No Git? On GitHub click **Code → Download ZIP**, unpack it to `C:\EveryDay`,
and run the last three lines from that folder.)

### Try the demo first (optional)

```powershell
npm run demo
```

Open http://localhost:8787. Everything works on **simulated** data, so you can
click around safely; the demo uses its own separate database. Stop it with
**Ctrl+C**.

### Start for real

```powershell
npm start
```

Open http://localhost:8787. Create your login, then follow the 9 onboarding
steps. Paste your **intervals.icu API key** in step 1. The app downloads 6
months of history and plans 4 weeks.

### Start automatically when the PC starts

Open PowerShell **as administrator** in `C:\EveryDay`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

This creates a Windows task called **EveryDay**. It starts at boot, even
before you log in, and restarts if it stops. It also turns off sleep when
the PC is on mains power. To remove it, run `scripts\uninstall-windows.ps1`.

## 3. Phone access (Tailscale)

1. Install Tailscale on the PC and the phone, and log in with the **same account** on both.
2. In the Tailscale admin console turn on **HTTPS certificates** (DNS → HTTPS Certificates).
3. On the PC, in an **administrator** PowerShell:
   ```powershell
   tailscale serve --bg 8787
   ```
   It prints an address like `https://my-pc.tailnet-name.ts.net`.
4. On the **iPhone**: open that address in Safari → **Share → Add to Home Screen**.
   Open EveryDay **from the icon**, then go to **Ustawienia → Powiadomienia → Włącz na tym urządzeniu**.
   (iOS only allows web notifications for apps added to the Home Screen.)

The app is only reachable inside your private Tailscale network, never from the open internet.

## 4. The local AI (Ollama)

After installing Ollama, in PowerShell:

```powershell
ollama pull qwen3.8          # official model (fallback)
ollama pull bge-m3           # small model for searching the coaching notes
```

For the **uncensored** model you chose: pull the build you trust, then give it
the name the app expects:

```powershell
ollama pull <uncensored-qwen3.8-build>
ollama cp <uncensored-qwen3.8-build> qwen3.8-uncensored
```

You can change the model names in **Ustawienia → Trener**. Check who made the
uncensored build and under what license before using it (spike S16 in `docs/spikes.md`).
If Ollama is not running, the app automatically uses its fixed templates;
nothing breaks.

## 5. Everyday use

- **Morning:** notification → check-in → read the brief → ride.
- **Changes** happen automatically and are explained in the brief. **Cofnij** (Undo) restores the plan.
- **Czat** (chat): "mam tylko 45 min", "boli mnie kolano", "dlaczego ten trening?".
- **Tydzień** (week): move, swap or skip workouts.
- **Postęp** (progress): fitness, freshness, FTP and W/kg, the road to 200 km.

## 6. Data, backups, updates

- Everything is in `C:\EveryDay\data\` (database, ride files, backups, logs). It is never uploaded to GitHub.
- A backup is made every night in `data\backups\` (14 daily + 8 weekly).
  You can add a second folder in **Ustawienia → Dane**.
- **Export everything** (ZIP) in **Ustawienia → Dane**.
- **Update** to a new version:
  ```powershell
  cd C:\EveryDay
  git pull
  npm install
  npm run build
  ```
  Then restart the PC, or run `Restart-ScheduledTask EveryDay` as administrator.

## 7. If something is wrong

- **Ustawienia → System** shows the last night job, the last sync, AI status and free disk space.
- Log file: `data\logs\server.log` (no health data is written to logs).
- intervals.icu key rejected → **Ustawienia → Połączenia → Zmień klucz API**.

---

## For developers

```bash
npm install
npm test            # engine, coach and server tests
npm run typecheck
npm run dev:server  # demo server with auto-reload on :8787
npm run dev:web     # Vite dev server with /api proxy
```

Structure: `packages/engine` (rule-based Plan Engine, pure TypeScript),
`packages/coach` (local AI, validator, knowledge search, chat), `apps/server`
(Fastify + built-in SQLite), `apps/web` (React PWA), `library/workouts`
(40 workouts), `knowledge/method-notes` (Polish coaching notes).
