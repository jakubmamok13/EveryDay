# Decision Log

Format: ID · date · decision · why · alternatives rejected · source (who decided).

## D-001 · 2026-10-01 · Planning first, no code yet
- **Decision:** Describe every detail in `docs/` before building anything.
- **Why:** User request.
- **Source:** User.

## D-002 · 2026-10-01 · Personal tool: one user (the author)
- **Decision:** v1 is built for **only one Athlete: the author**. No public sign-up.
- **Why:** User choice. It removes most third-party API limits (Strava's
  athlete caps, Garmin's company-only program) and most GDPR/multi-tenant work.
- **Rejected:** "me + friends" and "public from day one".
- **Consequence:** "registered account" shrinks to one protected login
  (or none, if the app runs only on the PC — see Q-ARC-05). Keep the data
  model per-Athlete anyway so opening up later is possible without a rewrite.
- **Source:** User (round 1).

## D-003 · 2026-10-01 · Coach AI runs on the user's PC; app provides full technical detail ("book") — *AI part superseded by D-044*
- **Decision:** The AI runs **locally on the user's PC** (no cloud AI API).
  Next to the short Daily Brief, the app also provides **full technical
  training detail ("book")**. Exact meaning is being clarified: Q-VIS-10.
- **Open:** PC hardware decides the model size (Q-ARC-06). Choice between a
  browser (WebGPU) and a local runtime (Ollama / LM Studio): S06.
- **Rejected:** own GPU server; cloud AI API.
- **Source:** User (round 1).

## D-004 · 2026-10-01 · intervals.icu is the data hub for v1
- **Decision:** Read Activities and Wellness from **intervals.icu** with a
  personal API key. Garmin, Zwift and MyWhoosh are connected **directly to
  intervals.icu, not via Strava** (Strava-sourced activities come out of the
  intervals.icu API as empty stubs).
- **Why:** Garmin, Zwift and MyWhoosh have no usable open API for us.
  intervals.icu receives Garmin wellness, including Body Battery (custom
  fields), HRV, sleep, resting HR and Training Readiness, and has an open API
  with workout/calendar write access.
- **Rejected for v1:** Strava direct (rides only, paid dev subscription, AI
  clause); Garmin direct (company-only, paused). Manual FIT upload is
  kept as a fallback (Q-INT-06).
- **Source:** User (round 1), based on research in spikes S01–S05.

## D-005 · 2026-10-01 · v1 Goal types — *extended by D-028 (primary + secondary)*
- **Decision:** v1 supports all four Goal types: **Event on a date**,
  **Raise FTP**, **Endurance / long rides**, **General fitness & health**.
- **Source:** User (round 1).

## D-006 · 2026-10-01 · "Book" = knowledge source for the Coach AI
- **Decision:** The full technical training detail is a **knowledge base the
  Coach AI uses** (retrieval / RAG over a training book or method), so its
  advice follows one consistent method. It is not primarily an in-app reading section.
- **Open:** which book or method (Q-VIS-11); whether rules or the AI decide
  the plan (Q-ARC-07).
- **Constraint:** copyrighted book text must stay **local** and never be
  committed to a public repo.
- **Source:** User (round 2).

## D-007 · 2026-10-01 · Brief and workout are delivered everywhere — *push channel superseded by D-018*
- **Decision:** The Athlete reads the Daily Brief / today's workout on:
  **phone (morning)**, **PC browser**, **Garmin watch / Edge** (workout
  only), and a **pushed message (email / Telegram)**.
- **Consequence:** the app must be reachable from the phone, not only on
  the PC. Deployment shape 2 or 3 in 03_technical_architecture.md (Q-ARC-05).
- **Source:** User (round 2).

## D-008 · 2026-10-01 · ~~Local AI runtime: native on a PC with an NVIDIA GPU (8 GB+)~~ — *superseded by D-017*
- **Decision (proposed by Claude, from user's hardware answer):** run the Coach
  AI with a native local runtime (Ollama / LM Studio / llama.cpp, localhost
  API) on the author's NVIDIA PC. Do not use browser WebGPU. That allows
  7–14B models; exact model chosen in spike S06.
- **Source:** User (hardware, round 2) + Claude proposal — confirm.

## D-009 · 2026-10-01 · Riding: MyWhoosh indoors, Garmin outdoors; delivery via intervals.icu
- **Decision:** Indoor = **MyWhoosh**, outdoor = **Garmin** device. Not Zwift.
  The app writes Planned Workouts to the **intervals.icu calendar**.
  intervals.icu then pushes them to **Garmin Connect** (watch / Edge) and to
  **MyWhoosh** (direct integration, next 7 days).
  Completed MyWhoosh rides return to intervals.icu directly.
- **Out of scope v1:** Zwift; our own Bluetooth/ERG trainer control.
- **Source:** User (round 2) + research (S04, S13).

## D-010 · 2026-10-01 · Training method: Coggan & Allen (power-based)
- **Decision:** The coaching method follows **Allen & Coggan, "Training and
  Racing with a Power Meter"**: FTP, 7 power zones, Load, Fitness / Fatigue /
  Form management (the Performance Manager model), power-profile limiters.
- **Consequence:** It is the Coach AI's knowledge source (D-006) and the basis
  of the Plan Engine rules. Where the book does not prescribe an algorithm
  (e.g. exact weekly structure per hours), we write explicit rules and mark
  them "our rule, not from the book".
- **Constraint:** the book text (the author's own copy) stays local on the PC,
  outside git (D-006).
- **Source:** User (round 3).

## D-011 · 2026-10-01 · Plan brain: rules decide, AI may adjust within limits
- **Decision:** The rule-based **Plan Engine** builds and adapts the plan.
  The **Coach AI** may **propose adjustments inside a safe envelope**
  (e.g. ±20% duration, swap to a workout of the same type, move a workout by
  ±1 day, downgrade intensity — never upgrade beyond the engine's limit).
  The engine validates every AI change and logs it (Adaptation with source = AI).
- **Rejected:** rules-only (less coach-like); AI-only (unpredictable, maths errors).
- **Open:** exact envelope (Q-ADP-04).
- **Source:** User (round 3).

## D-012 · 2026-10-01 · ~~Deployment: everything on the author's PC (always on)~~ — *superseded by D-043*
- **Decision:** Deployment shape **2**. App, database, sync, Plan Engine and
  Coach AI all run on the author's PC, which is on 24/7. The phone reaches the
  app through a **private tunnel** (e.g. Tailscale, no public exposure).
  Notifications are **sent out** from the PC (web push, D-018).
  intervals.icu delivers workouts to Garmin and MyWhoosh (cloud side), so
  the devices work even if the PC is down.
- **Cost:** €0 hosting.
- **Consequence:** the brief is generated on a schedule (night / early
  morning), so a slow model is acceptable for the brief. Interactive chat
  speed depends on the GPU.
- **Source:** User (round 3).

## D-013 · 2026-10-01 · Language Polish; start with Qwen 3.8 "uncensored" — *Polish stays; model part superseded by D-044*
- **Decision:** UI and coach messages in **Polish**. The first model is
  **Qwen 3.8 (27B), an uncensored community variant**, run via Ollama.
  The model is a swappable setting. Later candidates to benchmark: Bielik
  (Polish-native), the official Qwen 3.8, smaller models if speed is a problem.
- **Risks (spike S06, S16):** standard Qwen 3.8 27B q4 build is ~18 GB and
  recommended for 24 GB+ VRAM. On an 8–16 GB GPU it partly runs on the CPU
  (slower; fine for an overnight brief, slow for chat). "Uncensored"
  variants are community re-uploads: check who made them, the method and
  the license. They may lose some quality. Safety then relies fully on the
  Plan Engine rules (D-011), which is our design anyway.
- **Source:** User (round 3).

## D-014 · 2026-10-01 · Adaptation is automatic, announced, undoable
- **Decision:** When Readiness or progress calls for a change, the app
  **changes the plan automatically**, updates the intervals.icu calendar
  (so Garmin and MyWhoosh get the new workout), and the Daily Brief says
  **what changed and why**. **One tap undoes it.**
- **Rejected:** ask-first; auto-small / ask-big.
- **Source:** User (round 4).

## D-015 · 2026-10-01 · Daily Morning Check-in
- **Decision:** The Athlete does a ~10-second **Morning Check-in** every day
  (sleep quality, legs, motivation, sick yes/no; exact items TBD) **in the
  app**, opened from the daily notification (Telegram dropped by D-018).
- **Consequence:** the check-in is a first-class Readiness input next to
  Garmin wellness. The brief is finalized **after** the check-in (or at a
  cut-off time, Q-BRF-06).
- **Source:** User (round 4).

## D-016 · 2026-10-01 · Coach tone: friendly buddy
- **Decision:** The Daily Brief is **warm and motivating, still short**.
  Numbers come from the Plan Engine only.
- **Source:** User (round 4).

## D-017 · 2026-10-02 · ~~AI hardware: the author's AMD GPU (supersedes D-008)~~ — *superseded by D-043/D-044*
- **Fact:** The author's PC has an AMD GPU (not NVIDIA, as assumed in D-008).
  Exact hardware details removed from the public repo (D-046).
- **Decision (historical):** native local runtime **Ollama**, with LM Studio
  as fallback. No browser WebGPU.
- **Source:** User (round 5) + research.

## D-018 · 2026-10-02 · ~~One notification channel: web push from the app~~ — *superseded by D-045*
- **Decision:** No Telegram, no email. The app sends **one browser push
  notification** ("alert from web") to the phone. Tapping it opens the
  **Today** screen with the Morning Check-in and the Daily Brief.
  The check-in is done **in the app** (D-015 updated).
- **Consequence:** the app is an installable **PWA** served over **HTTPS
  inside the private tunnel** (Tailscale certificates), because service
  workers and push require HTTPS. On iPhone, web push works only after the
  app is added to the Home Screen. Spike S20; phone type needed (Q-UX-04).
- **Source:** User (round 5).

## D-019 · 2026-10-02 · ~~Coach Chat is in scope~~ — *superseded by D-044 (buttons instead of chat)*
- **Decision:** The Athlete can chat with the coach ("I only have 45 minutes
  today", "why this workout?"). Changes requested in chat go through the
  Safe Envelope (D-011) and are logged as Adaptations.
- **Open:** v1 or a later phase (decided in 09_v1_build_plan.md).
- **Source:** User (round 5: "that could be great").

## D-020 · 2026-10-02 · Indoor or outdoor is chosen each day
- **Decision:** The Athlete picks **Indoor / Outdoor each day** (part of the
  Morning Check-in, pre-filled with yesterday's guess). Each Planned
  Workout has **two variants**:
  - **Indoor:** power targets (ERG) for MyWhoosh on the smart trainer.
  - **Outdoor:** HR (and RPE) targets for the watch, since there is no
    outdoor power meter (to confirm, Q-INT-08).
  After the choice, the app writes the chosen variant to intervals.icu.
- **Risk:** the morning change must reach MyWhoosh / Garmin in time (spike S18).
- **Source:** User (round 5).

## D-021 · 2026-10-02 · Output clarity is a hard requirement
- **Decision:** Coach output must be **clear and direct**: no hedging, no
  disclaimers, no filler, and a fixed format. This was the user's reason for
  wanting an "uncensored" model.
- **How (proposal):** enforce it with the system prompt + a fixed brief
  template + an output validator (length, required fields, numbers must match
  the Plan Engine). This works with any model, so the uncensored variant is
  not required for clarity. Model choice to confirm: Q-ARC-11.
- **Source:** User (round 5) + Claude proposal.

## D-022 · 2026-10-02 · Knowledge Base starts with our own Method Notes (proposal)
- **Decision (Claude proposal — confirm):** The author has not found the book
  yet (round 5). Until then the Knowledge Base is **Method Notes** that we
  write ourselves, in our own words, from the public Coggan concepts (power
  zones, Performance Manager, ramp rates, workout types, taper rules). These
  notes are our text, so they **can be committed to git** and reviewed. The
  book is added to the local index later, if found.
- **Source:** User (round 5: "have to find it") + Claude proposal.

## D-023 · 2026-10-02 · Outdoor: HR now, power later; Wahoo bike computer
- **Fact:** Outdoors the author has a **Garmin watch + HR strap** and a
  **Wahoo** bike computer. There is **no power meter yet**, and one is planned.
- **Decision:** The Outdoor Variant uses **HR (+ RPE) targets** and HR-based
  Load. When outdoor rides start arriving **with power data**, the app offers
  to switch the Outdoor Variant to **power targets** (setting
  `outdoor_power_meter = yes`) and to re-check FTP outdoors vs indoors.
- **Open:** which device records outdoor rides and shows the workout:
  bike computer, watch or both (Q-INT-10). Both recording creates duplicates (S19).
- **Source:** User (round 6).

## D-024 · 2026-10-02 · Indoor rides: keep MyWhoosh's copy, ignore the watch copy
- **Fact:** Indoors **both MyWhoosh and the Garmin watch record** the ride.
- **Decision:** The **MyWhoosh** copy is the master (it has trainer power +
  HR). In intervals.icu, Garmin "VirtualRide" activities are filtered out.
  The app also runs its own **duplicate guard** (same day, overlapping time,
  similar duration → keep the one with power) so Load is never counted twice.
- **Source:** User (round 6) + Claude rule.

## D-025 · 2026-10-02 · Phone: must work on both iOS and Android
- **Decision:** The PWA and its notifications must work on **iPhone and
  Android**. On iPhone the app is added to the Home Screen once (required by
  iOS for web push). The onboarding shows that step.
- **Source:** User (round 6: "multifunctional iOS and Android").

## D-026 · 2026-10-02 · ~~Model confirmed: uncensored Qwen 3.8 (27B)~~ — *superseded by D-044*
- **Decision:** Start with the **uncensored Qwen 3.8 27B** via Ollama (user
  choice after the clarity explanation). The clarity rules (D-021) still
  apply. The official Qwen 3.8 is kept as the configured **fallback** model.
- **Guardrails:** before first use, check the build's source, method and
  license (S16). The Plan Engine's Safe Envelope (D-011) protects training
  decisions regardless of the model.
- **Source:** User (round 6).

## D-027 · 2026-10-02 · Weekly Availability set in onboarding + Bonus Day
- **Fact:** The author trains on **four fixed days**: about **1 h** on
  weekdays and **several hours** at the weekend, **sometimes an extra day**.
  The exact days are personal and not kept in the repo (D-046).
- **Decision:** Weekly Availability (days, max minutes, indoor/outdoor) is
  entered in onboarding and editable in Settings. A **Bonus Day** button
  ("Mam dziś czas") lets the Athlete add an unplanned session. The engine then
  offers an optional workout that fits current Form and **never compromises
  the next Key Workout** (default: easy Endurance or Recovery).
- **Source:** User (round 7) + Claude proposal (Bonus Day).

## D-028 · 2026-10-02 · Goal: raise FTP continuously + get ready for long rides; editable any time
- **Decision:** Goals have a **Primary** and an optional **Secondary** goal.
  Default: Primary = **Raise FTP** (no end date, rolling blocks), Secondary =
  **Endurance / long rides**.
- **Decision:** The Goal is set in **onboarding** (new account) and can be
  **changed any time** in settings for the existing account. A change
  regenerates the plan **from today**; history and Fitness are kept.
- **Source:** User (round 7: "I want in a new account to set this again, or change it in the old one").

## D-029 · 2026-10-02 · Outdoor: bike computer and watch both record; the bike computer is the master copy
- **Fact:** Outdoors **both the Wahoo bike computer and the Garmin watch**
  record and should show the workout.
- **Decision:** The Outdoor Variant is delivered to **both** devices
  (intervals.icu → Wahoo and → Garmin). For Load, the **bike computer's copy
  is the Master Copy** (a future power meter will pair to it). The watch copy
  is used only if no bike computer copy exists that day. The duplicate
  guard (D-024) applies.
- **Note:** the HR strap must be paired to both devices (ANT+ allows that;
  Bluetooth often allows one connection only). Spike S23.
- **Source:** User (round 7) + Claude rule.

## D-030 · 2026-10-02 · ~~PC runs Windows~~ — *superseded by D-043*
- **Fact:** The PC ran Windows.
- **Decision (historical):** Ollama for Windows, an auto-start background
  service, Tailscale for the tunnel.
- **Source:** User (round 7).

## D-031 · 2026-10-02 · Reminder every day, rest days included — *delivery by D-045*
- **Decision:** One notification **every day**. Training day: check-in →
  brief → workout. Rest day: check-in → recovery tip → Bonus Day offer.
  Time: Q-BRF-07.
- **Source:** User (round 7).

## D-032 · 2026-10-02 · intervals.icu setup is Phase 0
- **Fact:** The author has **no intervals.icu account yet**.
- **Decision:** Creating and wiring the intervals.icu account is **Phase 0**
  of the build plan (checklist in 09_v1_build_plan.md), before any code. The
  data-dependent spikes (S05, S13, S14, S18, S21) run on that real account.
- **Source:** User (round 7).

## D-033 · 2026-10-02 · Long-ride target: 200 km+ / 7 h+
- **Decision:** The Secondary Goal targets rides of **200 km+ / 7 h+**.
- **Conflict:** the normal weekend window is **≤ 4 h** (D-027). Proposal
  (default D-R8-08, awaiting OK): occasional **Long Ride Days** (e.g. one
  5–7 h ride every 4–6 weeks, confirmed by the Athlete a week ahead) plus
  **back-to-back weekends** (Sat 4 h + Sun 2–3 h) and **fueling practice** on
  every ride over 90 min.
- **Source:** User (round 8).

## D-034 · 2026-10-02 · ~~Notification time is a per-day setting~~ — *superseded by D-045*
- **Decision:** The Athlete sets the notification time **per day of the
  week** (default 07:00).
- **Source:** User (round 8).

## D-035 · 2026-10-02 · Claude builds it in TypeScript
- **Decision:** The author does not code. Claude builds and maintains the app
  in **TypeScript end to end** (PWA front-end, server, Plan Engine, sync).
  Exact framework choices go in 03_technical_architecture.md (proposal:
  Node.js LTS server, React + Vite PWA, SQLite single-file DB).
- **Consequence:** code and docs must stay readable for a non-programmer
  owner: plain-language README, one-command start, simple backups.
- **Source:** User (round 8).

## D-036 · 2026-10-02 · FTP: auto-detect + a test at the end of each block
- **Decision:** The app watches best efforts (estimated FTP) and **suggests**
  a new FTP when it changes. A **short test at the end of each 4-week block**
  confirms it (default: indoor ramp test on the smart trainer in MyWhoosh). Zones
  update only after the Athlete accepts.
- **Source:** User (round 8).

## D-037 · 2026-10-02 · Round 9: all 24 proposed defaults approved
- **Decision:** The author approved every proposed default ("OK"). They are
  now binding and are written into the module docs:

| # | Topic | Decision |
|---|---|---|
| R8-01 | Name | **EveryDay** |
| R8-02 | Login | ~~Email + password~~ → no login: the data lives on the phone (D-043); onboarding runs on first open |
| R8-03 | Data | Export / import all data (JSON) + delete everything in Settings |
| R8-04 | Onboarding | ≤ 10 questions (~3 min), pre-filled from intervals.icu |
| R8-05 | First test | No test in week 1; first test at the end of block 1 |
| R8-06 | Horizon | Rolling 4-week blocks; with an Event, periodize to its date |
| R8-07 | Manual moves | Move / skip / swap allowed; the rest of the week re-flows |
| R8-08 | Long rides | One Long Ride Day (5–7 h) every 4–6 weeks, confirmed a week ahead + back-to-back weekends |
| R8-09 | Strength | No strength sessions in v1; off-bike tips only |
| R8-10 | Library | Curated library (~40 workouts), each with indoor + outdoor variant |
| R8-11 | Missed workout | Key Workout → next free day this week if Form allows, else dropped; others dropped |
| R8-12 | Safe Envelope | ±20% duration, same-type swap, ±1 day, easier only; never 2 hard days in a row |
| R8-13 | Readiness | Our own score; Garmin's Training Readiness shown next to it and used as one input |
| R8-14 | FIT upload | ~~Yes~~ → not in the phone app; upload FIT files in intervals.icu |
| R8-15 | Nutrition | Fueling + hydration for rides > 90 min; no diet / weight-loss advice |
| R8-16 | No check-in | Brief waits for the check-in; „Pomiń” builds it from watch data only and says so |
| R8-17 | Outdoor | HR ranges; long rides = guidance rides with fueling reminders |
| R8-18 | Analytics | Minimal: Fitness/Form, FTP + W/kg, long-ride progress, weekly compliance |
| R8-19 | Chat memory | Pain and travel buttons save Chat Notes with an end date; visible + deletable („Pamiętam”) |
| R8-20 | Ride rating | too easy / just right / too hard (buttons; RPE derived, D-044) |
| R8-21 | Offline | The whole app works offline (data on the phone); sync when online |
| R8-22 | Raw data | Keep all ride data forever |
| R8-23 | Look | Mobile-first; dark/light follows the phone |
| R8-24 | LTHR | From the watch's auto-detection or intervals.icu estimate; no extra test |

- **Source:** User (round 9).

## D-038 · 2026-10-02 · API spikes run on the device, not from the cloud session — *the device is now the phone (D-043)*
- **Fact:** The Claude cloud environment's network policy blocks
  `intervals.icu` (still blocked after a settings change, also in a fresh
  session). The manual delivery test (calendar → devices) **worked**.
- **Decision:** The remaining API checks (S05 read fields, S14 write via
  API) run **on the author's device** (now the phone), where the app runs.
  Phase 1 sync code is written against the documented API and tested with
  recorded responses (09 Testing approach) until then.
- **Source:** Claude proposal; author chose the manual-test route (2026-10-02).

## D-039 · 2026-10-02 · ~~Build-time stack choices (no native add-ons)~~ — *superseded by D-043 (sql.js in the browser)*
- **Decision:** To keep the Windows install to "install Node, run one command":
  - Database: Node's built-in **`node:sqlite`** (no native module to compile).
  - Password hashing: Node's built-in **scrypt** instead of argon2.
  - Knowledge Base search: embeddings stored in SQLite, **cosine similarity
    in JavaScript** (a few hundred passages; no sqlite-vec extension).
  - HTTPS for the phone: **Tailscale Serve** in front of the app (the app
    itself listens on localhost only; no certificate handling in the app).
  - Runtime: TypeScript run directly with **tsx**; web app built with Vite.
- **Why:** Native modules (better-sqlite3, argon2, sqlite-vec) need build
  tools or matching binaries on Windows; the built-ins do the same job at our scale.
- **Source:** Claude (build phase, user asked for full auto build).

## D-040 · 2026-10-02 · HRV "bad" needs at least 3 low nights
- **Decision:** HRV band = 60-day mean − max(1 SD, 3%). Caution = tonight
  below the band. **Bad = 7-day average below the band and ≥ 3 low nights**
  in that week, so one bad night alone gives Yellow, not Red. *(our rule)*
- **Source:** Claude, found while testing the engine.

## D-041 · 2026-10-02 · Build refinements found in testing
- **Check-in:** two or more low answers (≤ 2) count as a strong ("bad")
  signal, so heavy legs + poor sleep gives a Yellow day. *(our rule)*
- **Your own requests** ("mam tylko 45 min", Skip, chat requests) may shorten a
  workout by more than 20%; the ±20% Safe Envelope limit applies to changes the
  AI proposes on its own. All other safety checks still apply.
- **Coach Chat answers arrive whole** (not word by word) with a "Trener pisze…"
  indicator; structured actions are validated before anything changes.
- **Ladder progression** from ride ratings applies to the next session of that
  category within 14 days; FTP changes also need updating in intervals.icu
  (the app reminds you; automatic FTP write-back is not done).
- **Source:** Claude, during the build (user asked for full auto build).

## D-042 · 2026-10-02 · v1 built; design details fixed during the build
- **Build:** all v1 modules (Phases 1–6 of 09) are implemented and tested in
  demo mode (62 automated tests + screenshots of every screen, light and
  dark). What still needs a real intervals.icu account is listed in 09 § "Build status".
- **Zone colors** (06 §4): validated with the dataviz palette validator.
  Seven separate hues fail colorblind and normal-vision separation, so zones
  use **one blue ramp in 5 steps** (Z1, Z2, Z3, Z4, Z5+), light and dark
  variants, with the exact zone always written next to it ("Z4").
- **Charts:** Fitness (blue) / Fatigue (orange) pair validated; projection
  drawn faded; one axis per chart; table view for every chart.
- **Windows autostart:** a Task Scheduler task (S4U: runs before login, no
  stored password, restarts on failure) installed by `scripts/install-windows.ps1`.
- **Phone access:** `tailscale serve --bg 8787` (HTTPS inside the tailnet).
- **AI runtime:** the app talks to the **Ollama API** only. LM Studio as a
  fallback (D-030) would need an extra OpenAI-compatible client — deferred
  (S25); without Ollama the app runs on templates.
- **Source:** Claude, during the build.

## D-043 · 2026-10-02 · Phone only, free: the whole app runs on the phone
- **Context:** After v1 was built the author said keeping a PC on all the
  time to load data makes little sense, and asked for a **free, mobile-only**
  setup.
- **Decision:** EveryDay becomes a **static PWA** hosted free on **GitHub
  Pages**. All logic runs **in the phone's browser**:
  - the Plan Engine, sync, readiness and brief code (former server) moved to
    `packages/core` and runs in the browser;
  - the database is **SQLite compiled to WebAssembly (sql.js)**, saved to
    **IndexedDB** after every change (300 ms debounce, and at once when the
    app is hidden);
  - **intervals.icu** stays the cloud hub: the phone calls its API directly
    (CORS is allowed for `/api/v1/`) with the API key, which is stored **only
    on the phone**;
  - the night job and day sync run **when the app opens or comes back to the
    screen** ("catch-up"), not on a schedule; intervals.icu still delivers
    the workouts to MyWhoosh, Wahoo and Garmin without the app running;
  - backups are a manual **JSON export / import** in Settings (the key is
    not exported);
  - **demo mode** runs in the browser with simulated data under a separate key.
- **Supersedes:** D-012, D-017, D-030, D-039 and the PC parts of D-003,
  D-018, D-038, D-042 (Tailscale, Windows autostart, Fastify server, login).
- **Trade-offs:** no login and no multi-device sync (one phone holds the
  data; export/import moves it). iPhone: Safari and the Home Screen app have
  **separate storage**, so onboarding should happen in the Home Screen app.
  Home Screen web apps are exempt from Safari's 7-day storage eviction.
- **Cost:** €0 (GitHub Pages + free intervals.icu).
- **Source:** User (round 10: "How to make it costless on mobile to work only on mobile?").

## D-044 · 2026-10-02 · No AI; buttons instead of text
- **Decision:** No language model at all and **no free-text chat**. Everything
  is a tap:
  - **Morning check-in = one tap** on a feeling: „W pełni sił”, „Dobrze”,
    „Średnio”, „Czuję się gorzej”, „Totalne wyczerpanie”, „Choroba”, plus
    optional „Coś boli?” body-part buttons and W domu / Na zewnątrz. Each
    feeling maps to fixed check-in answers (`FEELINGS` in `packages/core`):
    5/5/5, 4/4/4, 3/3/3, sleep 3 + legs 2 + motivation 2 (Yellow),
    **exhausted** (Red → rest, Key Workout handled like a sick day), **sick**.
  - **Trener** tab (replaces Czat): Mam mniej czasu (30–90 min), Lżej dziś,
    Dziś odpoczynek, Przesuń na jutro, Coś boli (body part → injury note for
    7 days + easier today), Wyjazd (3/7/14 days → travel note + skip those
    days, each restorable in Tydzień), Dlaczego ten trening? (purpose + the
    matching Method Note sections), Baza wiedzy (read the notes), Pamiętam
    (active notes, deletable).
  - **Ride rating:** three buttons (too easy / just right / too hard); RPE is
    derived (4 / 6 / 8).
  - The **Daily Brief** uses the fixed Polish templates (already the
    no-AI fallback in v1, D-021 format unchanged).
- **Unchanged:** every change still passes the Safe Envelope and is undoable.
- **Supersedes:** D-019, D-026, the AI parts of D-003, D-011, D-013, D-021
  (writing style), R8-19/R8-20 as noted in D-037.
- **Source:** User (round 10: "No AI: but no text just buttons like – totalnie
  wyczerpany, czuje się gorzej, chory, w pełni sił").

## D-045 · 2026-10-02 · Morning reminder via an iPhone Shortcut
- **Decision:** Without a server there is no web push. The reminder is an
  **iPhone Shortcuts automation**: Automatyzacja → Pora dnia (e.g. 07:00) →
  Uruchom natychmiast → Pokaż powiadomienie „Czas na poranny check-in”. The
  Athlete then taps the **EveryDay** icon. (A Shortcut cannot open a Home
  Screen web app by URL — it would open Safari, which has separate storage.)
  Android: a clock alarm. The guide is in onboarding and Settings; the
  chosen time is stored as a setting.
- **Supersedes:** D-018, D-034.
- **Source:** User (round 10: "iPhone Shortcut").

## D-046 · 2026-10-02 · No personal data in the public repository
- **Decision:** The repo stays **public** (free GitHub Pages). The author's
  weight, height, FTP, training days and device models were replaced in docs,
  code and tests by a generic **sample athlete** (FTP 250 W, 75 kg,
  Tue/Thu 1 h, Sat 3 h, Sun 2 h; generic device names). Real values are
  entered only in the app on the phone.
- **Note:** older commits in git history still contain the earlier values.
  Removing them needs a history rewrite and force-push; not done unless the
  author asks.
- **Source:** User (round 10: "Remove personal data").

## D-047 · 2026-10-05 · Other sports count in the load: full in Fatigue, weighted in Fitness
- **Context:** the author asked whether load counts only rides (it did) and
  asked for a scientific basis for counting other sports.
- **Research (2026-10-05):**
  - Fatigue is systemic → all sessions count. HR-based load underestimates
    strength work; session-RPE works across modes (Foster et al. 2001,
    J Strength Cond Res 15:109).
  - Fitness transfer is partial and sport-dependent: some VO2max transfer,
    largest from running, minimal from swimming, never above sport-specific
    training, specificity matters more in trained athletes (Tanaka 1994,
    Sports Med 18:330); cycling ↔ running cross-transfer, none with swimming
    (Millet et al. 2002, Int J Sports Med 23:55); short-term VO2max gains
    similar for run vs cycle training (Menges et al. 2026, Front Sports Act
    Living, meta-analysis of 7 RCTs).
  - Running (eccentric) causes more muscle damage than cycling (Millet et al.
    2009, Sports Med 39:179); running interferes with strength more than
    cycling (Wilson et al. 2012, J Strength Cond Res 26:2293); heavy
    resistance training lowers HRV and performance up to 48 h.
  - Running and cycling LTHR differ, so the cycling LTHR is not used for other sports.
- **Decision (our rule, tuned after the Learning Period):**
  - All intervals.icu activities are synced. Rides build the plan (matching,
    compliance, longest ride, eFTP); other sports only add load.
  - Load: intervals.icu's Load first (sport-specific thresholds), else a
    per-sport hourly default; strength never below 45/h.
  - **Fatigue weight 1.0 for every sport. Fitness weight:** ride 1.0, run 0.6,
    ski / row / elliptical 0.5, walk / hike 0.3, swim 0.2, strength / yoga 0,
    other 0.3. Form = Fitness − Fatigue as before.
  - New Readiness input **„Inne sporty (nogi)”**: run or strength Load ≥ 40
    yesterday or ≥ 80 two days ago → caution; ≥ 100 yesterday → bad.
  - Setting „Licz bieg, siłownię i inne sporty” (default on); off = rides only.
  - Method Note „Inne sporty” explains it in Polish with these sources.
- **Source:** User request (2026-10-05) + research by Claude.

## D-048 · 2026-10-05 · „Dlaczego dziś to?” card on Today
- **Decision:** a collapsible card on Today shows the whole decision chain:
  1. Plan: block, focus, week of the block, role of the day, day limit,
     workout purpose (or why today is a rest day);
  2. every readiness signal with its value, the limits it is judged by and
     its rating (ok / uważaj / źle / brak danych);
  3. the colour rule with the counts and the score formula;
  4. the decision (automatic or own change) and „Co by było, gdyby…” for
     the three colours;
  5. Fitness / Fatigue / Form and other sports of the last 7 days.
- It uses the stored readiness of the morning, so it always matches the brief.
- **Source:** User request (2026-10-05).

## D-049 · 2026-10-06 · Training features chosen from the app research (docs/10)
- **Decision:** the author chose A1, A4, B1, B2, B3, B5, B6, C1, C2, C3, C4,
  C5, D1, D2, D3 from [10 Feature research](10_feature_research.md) and asked
  for "the objectively best solution, backed by research" wherever a detail
  was open. A2, A3, A5 and B4 are not built. D-050 … D-065 record each choice.
- **Source:** User (2026-10-06: „A(1,4), B(1,2,3,5,6), C(1,2,3,4,5), D(1,2,3)”).

## D-050 · 2026-10-06 · A1 Green light for an extra ride on a rest day
- **Decision:** on a rest day Today shows „Zielone światło: możesz dziś
  dorzucić jazdę” with up to 3 options. Each option shows its effect on the
  next key workout („Forma w Czw: −5% → −14%”). One tap adds the ride and
  sends it to the devices; „Nie dziś” hides the card for that day.
- **Rule (our rule; all must hold):**
  1. no planned ride today; no trip, pain or illness note;
  2. readiness green; feeling „W pełni sił” or „Dobrze” (no check-in →
     recovery or Z2 only);
  3. Form ≥ −10% (≥ −20% for Z1/Z2 only);
  4. the week stays inside the weekly load cap (ramp rule);
  5. at least 1 free day left in the week; at most 2 extra rides a week;
  6. key workout tomorrow → only Z1/Z2 up to 75 min; tempo only with ≥ 3
     days to the next key day and „W pełni sił”; nothing moderate < 48 h
     before a hard day;
  7. simulated Form on the next key day stays ≥ −25% (the caution line is −30%).
- **Research:** autonomic recovery is complete within minutes to hours
  after rides below the first threshold, slower after threshold or interval
  work (Seiler et al. 2007, Med Sci Sports Exerc 39:1366). Full
  parasympathetic recovery takes about 24 h after easy work, 24–48 h after
  threshold work and ≥ 48 h after high-intensity work (Stanley et al. 2013,
  Sports Med 43:1259). Monotony without easy days raises illness and
  overreaching risk (Foster 1998, Med Sci Sports Exerc 30:1164).
- **Source:** User request (2026-10-06) + research by Claude.

## D-051 · 2026-10-06 · A4 Warning for tomorrow
- **Decision:** when tomorrow is a key or hard workout and the projected
  morning Form after today's load is below −30%, Today shows a yellow card;
  below −45% the card is red. Buttons: „Lżej jutro” (the same change as
  Trener › „Lżej”), „Przesuń na …” (if the day after is free) and „Zostaw plan”.
- **Basis:** intervals.icu Form zones as % of Fitness: below −30% is
  „High risk”. We add −45% as our red line. The forecast uses load only,
  because next night's HRV is unknown.
- **Source:** User choice; TrainerRoad Red Light Green Light (product idea).

## D-052 · 2026-10-06 · B1 Visible progression levels
- **Decision:** Postęp shows the ladder level for Sweet Spot, Próg, VO2max,
  Tempo, Beztlenowe and Długa jazda (level / highest level in the library).
  Today's workout gets a chip comparing the workout level with the athlete's
  level:
  - below → „łatwy dla Ciebie”;
  - equal → „osiągalny”;
  - +1 → „ambitny”;
  - +2 or more → „bardzo ambitny”.
- **Source:** User choice; TrainerRoad Progression Levels and Workout Levels.

## D-053 · 2026-10-06 · B2 Five-step ride rating
- **Decision:** after a ride: „Ukończone interwały: Całość / Częściowo /
  Nie” and „Jak ciężko było?”: Łatwo / Umiarkowanie / Ciężko / Bardzo
  ciężko / Na maksa.
  - Score for the ladder: +1 / +0.5 / 0 / −0.5 / −1. „Częściowo” adds
    −0.5. „Nie” always scores −1.
  - Ladder +1 when the last two rated rides of a category sum ≥ 1.5 and
    compliance ≥ 90%.
  - Ladder −1 when the last ride scores ≤ −1, the last two sum ≤ −1, or
    compliance < 80%.
  - RPE stored: 3 / 5 / 7 / 8 / 10 (CR-10 scale).
  - The old 3-button rating still works (`feel`).
- **Research:** session-RPE is a valid load measure across intensities
  (Foster et al. 2001, J Strength Cond Res 15:109).
- **Supersedes:** the 3-step rating in M11 for new ratings.

## D-054 · 2026-10-06 · B3 Power profile from daily rides
- **Decision:** best 5 s, 1 min, 5 min and 20 min power of the last 12
  weeks. The app computes these itself from the 1 Hz power stream of each
  ride with power (D-063), so no test is needed.
  - W/kg is placed on Coggan's power profile table (0 = untrained,
    100 = world class) for men or women (setting in Profil).
  - Rider type: sprinter, puncher, time trialist / climber, or all-rounder.
  - The weakest of the four is shown.
- **Plan effect (raise-FTP goal only):** a weak VO2max (5 min) or threshold
  (FTP) replaces the second quality workout of load weeks with that
  category. Sprint and 1-min power are shown but never steer the plan.
- **Research:** Allen & Coggan, *Training and Racing with a Power Meter*,
  power profile table. The women's bottom values are approximate (the table
  is less complete there).
- **Source:** User choice; Wahoo 4DP, Xert, Garmin Cycling Ability.

## D-055 · 2026-10-06 · B5 Durability
- **Decision:** for rides ≥ 2 h with power, the best 5-min and 20-min power
  **after 20 kJ/kg of work** is compared with the fresh best of 12 weeks.
  - Shown: „utrzymujesz X% mocy 20-min”, capped at 100%.
  - Bands: ≥ 95% very good, 90–95% good, 85–90% fair, < 85% to work on.
- **Research:** durability is the time of onset and size of the drop in
  physiological profile during prolonged exercise (Maunder et al. 2021,
  Sports Med 51:1619). Better riders lose ~4% of 20-min power after
  50 kJ/kg; weaker riders lose more (review 2025, Eur J Appl Physiol).
- **Limit:** a value is only as good as the late efforts. Without a hard
  effort late in a long ride, the result underestimates durability.

## D-056 · 2026-10-06 · B6 FTP confidence
- **Decision:** Postęp shows the eFTP estimate with a confidence level. It
  counts hard efforts in 42 days: best 20 min ≥ 90% of FTP or best 5 min
  ≥ 106% of FTP.
  - Confidence: ≥ 3 efforts high, 1–2 medium, 0 low.
  - Low confidence and the last test > 42 days ago → advice to do the ramp
    test in the next recovery week.
  - High confidence → „Test nie jest potrzebny”.
- **Source:** User choice; TrainerRoad AI FTP Detection, intervals.icu eFTP.

## D-057 · 2026-10-06 · C1 „Ten tydzień jest inny…”
- **Decision:** in Tydzień, one week can have its own availability (days
  on/off, minutes 30 min – 4 h). It is stored in `week_override`, and the
  plan from today is rebuilt for that week only. „Przywróć zwykły tydzień”
  removes it. The normal availability never changes.
- Plan roles (long day, quality days) are computed per week from that
  week's availability.
- **Source:** User choice; JOIN (most praised feature).

## D-058 · 2026-10-06 · C2 Season events A / B / C
- **Decision:** Ustawienia › Sezon: date, name, priority, „w upale”. The
  primary Event goal counts as an A event.
  - **A:** 2-week taper. Volume ×0.75 in week −2 and ×0.5 in week −1.
    Intensity kept (hard days stay hard but shorter). Openers the day
    before. 5 easy days after.
  - **B:** 4 lighter days before, openers the day before, 2 easy days after.
  - **C:** openers or an easy ride the day before, 1 easy day after.
  - Event day: no workout.
- A Long Ride Day is never proposed in these windows. One that is already
  proposed or confirmed is withdrawn when an event is added.
- **Research:** best taper is ~2 weeks with volume cut by 41–60%, and
  intensity and frequency kept (Bosquet et al. 2007, Med Sci Sports Exerc
  39:1358, meta-analysis of 27 studies).

## D-059 · 2026-10-06 · C3 Form forecast for important days
- **Decision:** for events and confirmed Long Ride Days in the next 8 weeks,
  Postęp shows projected Fitness and Form (in % of Fitness) on the day,
  using the planned load.
  - Targets: A +5 … +20%, B −5 … +15%, C −15 … +10%, Long Ride Day
    −10 … +15%.
  - Verdict: „w docelowym zakresie”, „trochę poniżej celu”, „zmęczony”
    (more than 15 points below the target), „bardzo świeży”.
- **Research:** intervals.icu Form zones as % of Fitness: Fresh +5 … +20%
  (race ready), Transition above +20% (fitness fades). We use % rather
  than Coggan's absolute TSB +15 … +25, because absolute values suit only
  riders with high Fitness. This matches the other Form thresholds in the
  app (−30%, −45%).

## D-060 · 2026-10-06 · C4 Return after a break
- **Decision:** after ≥ 7 days without a ride (checked once per break, not
  during an active trip or illness note), the plan is rebuilt from today:

  | Days off | Ladder | FTP suggestion | First week volume | Easy days first |
  |---|---|---|---|---|
  | 7–13 | −1 | — | 70% | 2 |
  | 14–27 | −2 | ×0.97 | 60% | 3 |
  | ≥ 28 | −3 | ×0.94 | 50% | 3 |

  The FTP change is only a suggestion; the author accepts it.
- **Research:** VO2max falls ~7% in the first 12–21 days without training
  (Coyle et al. 1984, J Appl Physiol 57:1857). Detraining review: Mujika &
  Padilla 2000, Sports Med 30:79 and 30:145.

## D-061 · 2026-10-06 · C5 Interval block (optional)
- **Decision:** Trener › „Blok interwałowy” starts on the next Monday.
  - Week 1: VO2max on every available day ≥ 45 min, except the long day.
    No ramp cap that week.
  - The next 3 weeks: 1 VO2max session plus endurance.
  - Available only for the „Podnieść FTP” goal, with ≥ 3 days of ≥ 45 min
    a week, and not within 5 weeks (block + 3 weeks) before an A event.
  - It can be cancelled before it starts.
  - Offered automatically when D3 finds stagnation.
- **Research:** block periodization of HIT in trained cyclists (5 sessions
  in week 1, then 1 a week) gave larger VO2max and power gains than the same
  sessions spread evenly (Rønnestad et al. 2014, Scand J Med Sci Sports 24:34).

## D-062 · 2026-10-06 · D1 Carbohydrate per day, D2 heat acclimation
- **D1 decision:** Today shows the day's carbohydrate need:
  - mało 3–5 g/kg; średnio 5–7; dużo 6–10; bardzo dużo 8–12;
  - grams from the weight in Profil;
  - tomorrow's long or hard ride raises today's level by one step at most.
  - No diet or weight-loss advice (R8-15).
- **D1 research:** Thomas, Erdman & Burke 2016, ACSM / AND / DC joint
  position, Med Sci Sports Exerc 48:543.
- **D2 decision:** for an event marked „w upale”, Today shows a heat card
  from 14 to 2 days before:
  - ride in the heat (no fan or warmer clothes), easy 45–60 min, more drink;
  - training days in the window are counted against about 10;
  - optional hot bath after an easy ride (≤ 40 °C, ≤ 40 min).
  - From 3 days before: no extra heat.
- **D2 research:** most heat adaptations come in 7–14 days (Périard et al.
  2015, Scand J Med Sci Sports 25 Suppl 1:20; Racinais et al. 2015
  consensus, Br J Sports Med 49:1164). Post-exercise hot-water immersion
  at 40 °C for up to 40 min induces heat acclimation (Zurawlew et al. 2016,
  Scand J Med Sci Sports 26:745).

## D-063 · 2026-10-06 · Power data: own computation from streams
- **Context:** B3 and B5 need best powers, and B5 needs power **after** a
  given amount of work. A power curve gives only the bests, not their timing.
- **Decision:** the phone downloads the watts stream of each ride with power
  (`GET /api/v1/activity/{id}/streams.json?types=watts`) and computes the
  bests and durability itself.
  - Up to 12 rides per run, newest first, last 12 weeks.
  - The result is cached in `activity.peaks_json`; `streams_done` marks a
    ride as done.
  - The parser accepts several response shapes. The real shape is checked
    in spike S29.
- **Source:** Claude (research choice).

## D-064 · 2026-10-06 · D3 Weekly summary and stagnation
- **Decision:** Monday to Wednesday, Today shows last week:
  - rides done of planned (or the ride count when nothing was planned) and
    other sports;
  - Load vs plan and the Fitness change;
  - levels that went up and FTP.
  - „OK” hides it until next week.
- **Stagnation (our rule):** 6 weeks with no level up, FTP within ±1.5% and
  Fitness not rising (≤ +2). The card then offers the interval block
  (D-061), or a lighter week when a block is not possible. Ladder levels
  are saved every Monday (12 weeks kept).
- **Source:** User choice; TrainingPeaks / TrainerRoad weekly summaries.

## D-065 · 2026-10-06 · Bug fix: catch-up lock
- **Problem found in testing:** when catch-up had nothing to do, its promise
  finished before it was stored as „running”. The finished promise then
  stayed stored, and every later catch-up returned it, so syncing stopped
  until the app was restarted.
- **Fix:** a per-app lock (`WeakMap`) that is cleared only by the same
  promise, plus a regression test („none” first, later „sync”).

## D-066 · 2026-10-07 · Answers are remembered: no daily re-asking
- **Problem (reported by the author):** after „Nie tym razem” on a Long Ride
  Day, the same proposal came back the next day. The rule looked only at
  confirmed rides, so the daily job proposed the declined date again. A
  rejected FTP suggestion had the same flaw: the next eFTP check created it
  again.
- **Decision:**
  - A declined (or withdrawn) Long Ride Day date is never proposed again.
    The next weekend can be proposed once, about a week later; the 4–6-week
    cycle does not restart.
  - A rejected FTP value is not suggested again for 28 days, unless the
    estimate moves ≥ 3% away from it.
  - After „Nie tym razem” the app says the normal plan stays, and points to
    Tydzień › „Ten tydzień jest inny…” for a shorter weekend.
  - Longer toasts stay on screen longer (about reading speed).
- Regression tests cover both cases.
- **Source:** User (2026-10-07).

## D-067 · 2026-10-07 · Copy on the author's Google Drive through an Apps Script link
- **Context:** the author asked whether the app could read and write its data
  in a Google Drive folder shared „anyone with the link can edit”.
- **Research (2026-10-07):**
  - The Drive API allows anonymous access (API key) for **reading** public
    files only. Every write needs OAuth or a service account, whatever the
    folder's link setting.
  - Google sign-in (OAuth popup or redirect) inside an iPhone Home Screen app
    is unreliable: the popup loses `window.opener`, or the redirect lands
    in Safari instead of the app.
  - Apps Script web apps answer no CORS preflight (OPTIONS → 405). Simple
    requests (GET, POST `text/plain`, no custom headers) work: `/exec`
    answers 302 to `script.googleusercontent.com` with
    `Access-Control-Allow-Origin: *`.
- **Decision:** the author deploys a small **Google Apps Script** from
  `tools/everyday-kopia.gs` on their own account ("Execute as: me", "Who
  has access: Anyone"). Its `/exec` address works as the link: the app
  reads and writes through it with no Google sign-in in the app.
  - On Drive: folder „EveryDay” with `everyday-kopia.json` (latest) and one
    `everyday-RRRR-MM-DD.json` per day, 14 days kept.
  - The app saves by itself 20 s after a change and on every open, only
    when the data changed (hash of the data). It checks the Drive copy
    first.
  - A newer copy saved by **another device** is never overwritten
    silently: Today asks „Wczytaj z Dysku” or „Zostaw dane z telefonu”.
  - Connecting to a link that already holds a copy also asks: load it, or
    replace it with this phone's data.
  - New phone: onboarding › „Masz kopię na Dysku Google?” (API key + link).
  - Errors are kept for Settings. Today warns only when no copy was saved
    for 7 days.
  - Demo mode never uploads. The intervals.icu key is never in the copy.
  - The export (file and Drive) now also carries the athlete's `meta`
    state: eFTP history, ladder history, return after a break. It leaves
    out device-only keys (job times, the link). Import keeps this phone's
    intervals.icu connection even if the file has none.
- **Accepted risk (author: „nie ma znaczenia”):** whoever has the `/exec`
  address can read and overwrite the copy.
- **Rejected:**
  - a link-shared folder without sign-in: writes are impossible;
  - Google sign-in in the app: unreliable on iPhone;
  - storing data in intervals.icu: misuse of a third-party service.
- **Verified:** core tests with a stand-in script (requests stay
  CORS-simple), and Playwright with a local HTTPS server playing both
  Google hosts. Restore, auto-save after a change, conflict and „keep mine”
  were checked, with 0 preflight requests. The real script on the iPhone is
  spike S31.
- **Source:** User (2026-10-07).
