# 03 — Technical Architecture

Status: **SPEC v1.1** — phone only (D-043), no AI (D-044). Earlier PC shape
(D-012, D-017, D-030, D-039) is superseded and kept only in the decision log.

## 1. Shape

One athlete, one phone, no server of ours, €0 hosting.

```
 GitHub Pages (static files only: HTML, JS, CSS, sql.js WebAssembly, icons)
        │  first visit / updates
        ▼
 Phone — EveryDay PWA (Home Screen app, iOS + Android)
 ┌──────────────────────────────────────────────────────────────────┐
 │  React UI (Polish)                                                │
 │   └─ in-process router  (handle("POST", "/api/checkin", …))       │
 │       ├─ Plan Engine (pure TypeScript)                            │
 │       ├─ Sync ── fetch ──► intervals.icu API (CORS, Basic auth)   │
 │       ├─ Daily: readiness, adaptation, brief templates            │
 │       └─ Catch-up jobs on open / return to the screen             │
 │  SQLite (sql.js, WebAssembly) in memory                           │
 │   └─ saved to IndexedDB after every change                        │
 │  Service worker: offline app shell                                │
 └──────────────────────────────────────────────────────────────────┘
        │ calendar writes                      ▲ rides, wellness
        ▼                                      │
 intervals.icu (cloud) ─► MyWhoosh · Wahoo · Garmin   (delivered without the app open)

 iPhone Shortcuts automation ─► "Czas na poranny check-in" notification (D-045)
```

If the phone is off or the app is not opened, devices still have the
workouts already in the intervals.icu calendar (7 days ahead). Adaptation
happens when the Athlete opens the app.

## 2. Brain (D-011, D-044)

| Layer | Job | Nature |
|---|---|---|
| **Plan Engine** (`packages/engine`) | Plan generation, Load / Fitness / Fatigue / Form, Readiness, Adaptation, Safe Envelope, brief facts and Polish templates | Pure functions, deterministic, unit-tested; Coggan & Allen rules (D-010) |
| **Core** (`packages/core`) | Database, sync, morning flow, actions, catch-up jobs, router | Runs in the browser; tested in Node with sql.js |

There is no language model. Every text comes from fixed templates; every
change passes the Safe Envelope.

## 3. Stack

| Part | Choice | Notes |
|---|---|---|
| Language | **TypeScript** everywhere | Claude builds and maintains it (D-035) |
| Front-end | **React 19 + Vite**, installable **PWA** | Mobile-first (R8-23); relative base path so it works under `/EveryDay/` |
| Database | **SQLite via sql.js** (WebAssembly) | Same SQL schema and migrations as v1; ~650 kB wasm, cached by the service worker |
| Persistence | **IndexedDB** (`everyday` › `files`: `db`, `db-demo`, `mode`) | `db.export()` 300 ms after a change and at once when the app is hidden; `navigator.storage.persist()` requested |
| intervals.icu | `fetch` with `Authorization: Basic base64("API_KEY:<key>")` | CORS is allowed for `/api/v1/`; key stored only in the phone's database |
| Knowledge Base | Method Notes bundled at build time (`import.meta.glob`, raw Markdown) | Keyword search; tiny safe Markdown renderer |
| Offline | Service worker: network-first page, cache-first hashed assets | The data is local, so the whole app works offline except sync |
| Hosting | **GitHub Pages** from the `gh-pages` branch, built and pushed by GitHub Actions (`.github/workflows/pages.yml`) | Typecheck + tests must pass before deploy |
| Tests | Vitest: engine (pure) + core (sql.js in Node, full morning loop via the router) | Playwright screenshots for UI checks |

## 4. Repository layout

```
/apps/web               React PWA (Polish UI), runtime (sql.js + IndexedDB), service worker
/packages/core          Browser "server": db, sync, daily, plan, actions, catch-up, router
/packages/engine        Plan Engine: load, readiness, planner, rules, brief (pure)
/packages/shared        Types and date helpers
/library/workouts       Workout Library (~40 workouts, JSON, our content)
/knowledge/method-notes Method Notes (our Polish text, bundled into the app)
/docs                   These planning docs
/private                Anything private (e.g. a book) — gitignored, never bundled
```

## 5. Jobs and timing (catch-up, D-043)

The phone cannot run background jobs, so the former schedule runs when the
app opens or becomes visible (`catchUp()`, one at a time):

| Job | When | Steps |
|---|---|---|
| **Daily** (former night job) | first open of the day (`last_night_job < today`) | Sync 14 days (rides, wellness) → duplicates guard → Load, Fitness, Fatigue, Form → missed-workout rule → block advance → Long Ride proposal → keep 4 weeks planned → calendar writes (yesterday … +7 days) → FTP check |
| **Day sync** | later opens, ≥ 15 min apart | Sync 3 days → match rides → compliance → Ride Rating prompt; retry pending calendar writes |
| **Check-in** | on the feeling tap | Readiness → Adaptation → calendar write (chosen variant) → brief (instant, templates) |
| **Reminder** | iPhone Shortcut at the chosen time | Notification only; the Athlete opens the app |

Dates use the phone's time zone (`Intl…timeZone`), DST-safe.

## 6. Data flow of one morning

1. The Shortcut notification → the Athlete opens EveryDay from the Home Screen.
2. The app loads the database from IndexedDB, shows Today at once, and runs
   catch-up in the background (sync + daily job); Today refreshes when it ends.
3. One tap on a feeling → readiness + adaptation + brief → the chosen
   variant is written to intervals.icu → MyWhoosh / Wahoo / Garmin.
4. After the ride, the next open syncs it, matches it to the plan and asks
   „Jak było?” (three buttons).

## 7. Security and privacy

- No server, no account, no analytics. The app's files are public; **the
  data is not**: it stays in the phone's IndexedDB.
- The intervals.icu key is stored only on the phone and sent only to
  `intervals.icu` over HTTPS. Export files never contain it.
- iPhone: Safari and the Home Screen app have separate storage; Home Screen
  apps are exempt from Safari's 7-day eviction of script-written storage.
- Losing the phone or deleting the app loses the data → **copy on the
  author's Google Drive** (Google sign-in, `drive.file`, D-068): saved
  automatically after changes and on open, restored on a new phone. Manual
  **export** (JSON) to Files / iCloud still works.
- No personal data in the repository (D-046).

## 8. Limits (accepted)

- No live multi-device sync: the Drive copy moves data between devices, and
  a newer copy from another device is offered, never merged (D-068).
- Adaptation needs the app to be opened; devices still get the default plan.
- intervals.icu outage → the app works from local data; sync retries on the
  next open.

## Open questions

None blocking. Confirm on the phone: S05 (the real account),
S14 (API writes reach the devices), S26 (field names), S27 (CORS from the installed app),
S31 (Google sign-in and the Drive copy with EveryDay's own client).
