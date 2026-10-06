# 09 — v1 Build Plan

Status: **v1 BUILT (2026-10-02), then rebuilt phone-only as v1.1** (D-043 –
D-046) — see "Build status" at the end. Each phase ends with something
**usable** and an exit test the author can check on the phone.

## Phase 0 — Setup and spikes

### 0a. Author's checklist (D-032)

1. Create an **intervals.icu** account.
2. Link **Garmin Connect**: grant Activities + Wellness + Sleep scopes, tick
   "Download wellness data", and add custom wellness fields
   `BodyBatteryMin` / `BodyBatteryMax`.
3. Link **MyWhoosh** (workout sync + ride upload).
4. Link **Wahoo** (bike computer: workout sync + ride upload).
5. Add a filter so Garmin **VirtualRide** is ignored (D-024).
6. Set FTP, weight, LTHR / max HR in intervals.icu (R8-24).
7. Let it import history (Garmin backfill), so Fitness starts with real data.
8. Generate a personal **API key** (Settings → Developer).

### 0a progress (2026-10-02)

| Step | Status |
|---|---|
| 1. intervals.icu account | ✔ done (API key created) |
| 2–4. Link Garmin / MyWhoosh / Wahoo | ✔ done |
| 5. VirtualRide filter | ? to confirm |
| 6–7. FTP / weight / history import | ? to confirm |
| S14 test workout | ✔ Manual test done: a workout added by hand to the intervals.icu calendar arrived on the devices |
| 8. API key | ✔ done. It was shared in chat → **regenerate it** and paste the new one only into the app on the phone. Never committed. |

The Claude cloud environment blocks `intervals.icu`, so the **API parts** of
S05 / S14 run on the author's phone (D-038, D-043).

### 0b. Spikes on the real setup (on the phone)

| Spike | Question | Exit |
|---|---|---|
| S05 / S26 | Wellness + activity fields via the API (HRV, Body Battery, readiness, load, eFTP) | Field map written into 07 |
| S27 | The installed PWA can call the intervals.icu API (CORS) | Onboarding „Połącz” succeeds on the phone |
| S14 | A workout written via the API arrives in MyWhoosh, on the bike computer and on the watch | Seen on all three |
| S18 | Same-morning swap indoor ↔ outdoor arrives in time | Delay measured; fallback chosen if needed |
| S21 | The bike computer shows HR-target steps correctly | Photo of the screen |
| S23 | HR strap on bike computer + watch at the same time | Both recordings have HR |

Spike results update the docs (confirmed → architecture; problem → DECISIONS).

## Phases 1–6 (v1, PC version — done)

1. **Foundation:** scaffold, SQLite schema + migrations, intervals.icu sync,
   duplicates guard, Load / Fitness / Fatigue / Form.
2. **Plan Engine & delivery:** Workout Library (~40), onboarding, rolling
   4-week blocks, event periodization, calendar writes, Week moves, 12-week simulation.
3. **Daily loop:** check-in, readiness (Learning Period), adaptation + Undo,
   template brief, ride matching, progression, missed-workout rule, Bonus Day.
4. **Coach AI** (later removed by D-044): Ollama client, prompts, validator;
   **Method Notes** stay as the Knowledge Base.
5. **Coach Chat** (replaced by Trener buttons, D-044); Chat Notes stay.
6. **Progress, FTP, long rides, data:** charts, eFTP + ramp test, Long Ride
   Days, fueling, export.

## Phase 7 — Phone only, buttons only (v1.1, D-043 – D-046)

- Move the server logic into `packages/core` (runs in the browser); sql.js +
  IndexedDB; in-process router; catch-up jobs on open.
- Remove the PC parts: Fastify server, login, web push, Windows scripts,
  Tailscale, Ollama / coach package.
- One-tap check-in (six feelings + pain body parts); „Totalne wyczerpanie” → rest.
- Trener tab: quick actions, pain, travel, „Dlaczego ten trening?”, Baza wiedzy, Pamiętam.
- JSON export / import, delete everything, demo mode in the browser.
- iPhone Shortcut reminder guide.
- GitHub Pages workflow (typecheck + tests + build + deploy).
- Personal data replaced by a sample athlete in docs, code and tests.

**Exit:** the app opens from the Home Screen, onboarding connects
intervals.icu, and a full morning (check-in → brief → workout on the
devices) works with no PC.

## Later (not v1)

Outdoor power meter switch-over polish (when bought) · strength sessions ·
Zwift · own trainer control · Strava · multi-device sync · English UI.

## Testing approach

- **Engine:** unit tests for every rule + the 12-week simulation (sample athlete).
- **Core:** the whole morning loop through the in-process router on sql.js in
  Node: one-tap feelings, undo, outdoor variant, exhausted / sick rest,
  quick actions, travel + restore, export → import round trip, catch-up,
  wipe; intervals.icu mapping tests.
- **UI:** Playwright on a phone-sized viewport (demo mode): onboarding →
  demo → check-in → reload (data persists) → Trener → Week → Progress →
  Settings → exit demo; screenshots light and dark.

---

## Build status (2026-10-02, v1.1)

| Part | Built | Verified here (demo mode) | Still to verify on the phone |
|---|---|---|---|
| Core in the browser | ✔ sql.js DB, IndexedDB save, router, catch-up | ✔ tests, Playwright (data survives reload) | real intervals.icu fields (S05/S26), CORS (S27) |
| Plan Engine & delivery | ✔ unchanged engine, calendar writes from the phone | ✔ 12-week simulation, fake intervals.icu | API write reaches MyWhoosh / bike computer / watch (S14, S21), same-morning switch (S18) |
| Daily loop | ✔ one-tap check-in, readiness, adaptation + undo, template brief, ratings, bonus day | ✔ end-to-end tests, screenshots | — |
| Trener buttons | ✔ shorten / easier / rest / tomorrow / pain / travel / why / notes | ✔ tests, screenshots | — |
| Progress, FTP, long rides | ✔ charts, eFTP + ramp test, Long Ride Days, fueling | ✔ tests | eFTP / best-minute fields (S26) |
| Data | ✔ export / import JSON, delete everything, demo mode | ✔ round-trip test | — |
| Hosting | ✔ GitHub Actions → `gh-pages` branch → Pages | CI: typecheck, tests, build pass | site live (if not: Settings → Pages → Deploy from branch `gh-pages`) |

### Research features (2026-10-06, v1.2 — D-049 … D-065)

| ID | Feature | Built | Verified here (demo mode) | Still to verify on the phone |
|---|---|---|---|---|
| A1 | Green light for an extra ride | ✔ | ✔ tests + Playwright (rest day 2026-10-07: offer with 3 options) | — |
| A4 | Warning for tomorrow | ✔ | ✔ tests | — |
| B1 | Progression levels + challenge chip | ✔ | ✔ tests + screenshots | — |
| B2 | 5-step rating + „Ukończone interwały” | ✔ | ✔ tests + screenshots | — |
| B3 | Power profile (Coggan table) | ✔ | ✔ tests; demo: 12 rides with power → „Czasowiec / wspinacz” | streams endpoint shape (S29) |
| B5 | Durability after 20 kJ/kg | ✔ | ✔ tests (demo 3 h rides with power) | needs long rides with power (S29) |
| B6 | FTP confidence | ✔ | ✔ tests | — |
| C1 | „Ten tydzień jest inny…” | ✔ | ✔ tests + Playwright sheet | — |
| C2 | Season events A/B/C, taper | ✔ | ✔ tests (openers the day before, no workout on the day, Long Ride Day withdrawn) | — |
| C3 | Form forecast | ✔ | ✔ tests + screenshots | — |
| C4 | Return after a break | ✔ | ✔ tests (gap 7+ days → plan rebuilt, ladder down) | — |
| C5 | Interval block | ✔ | ✔ tests + Playwright (Trener card) | — |
| D1 | Carbohydrate of the day | ✔ | ✔ tests + screenshots | — |
| D2 | Heat acclimation | ✔ | ✔ tests + Playwright | — |
| D3 | Weekly summary + stagnation | ✔ | ✔ tests + screenshots | — |

Tests: 75 automated (engine + core), typecheck and production build pass;
Playwright on a 390 px viewport walks through every new card with no
console errors. Bugs found and fixed while testing:
- catch-up lock (D-065);
- form-forecast verdict and scale (D-059);
- Long Ride Day proposed the day before an A event (D-058);
- „0 z 0 zaplanowanych” in the summary;
- durability above 100%;
- 59-min easy days after an event.

Known gaps (not blocking first use):
- FTP accepted in the app must also be changed in intervals.icu / MyWhoosh by hand (the app reminds you).
- Adaptation happens only when the app is opened (devices keep the default plan otherwise).
- Exact intervals.icu field names are mapped defensively; the first real sync confirms them (S26).
- Power profile and durability need rides recorded **with power** (indoor
  rides count); outdoor rides without a power meter are skipped (S29).

### Next step for the author

1. On the iPhone open **https://jakubmamok13.github.io/EveryDay/** in Safari → Udostępnij → „Do ekranu początkowego”.
2. Open EveryDay **from the icon**, paste the (new) intervals.icu API key, finish onboarding.
3. Set the Shortcut reminder (Ustawienia › Poranne przypomnienie).
4. Tell Claude what works and what does not; the spikes above are then closed in these docs.
