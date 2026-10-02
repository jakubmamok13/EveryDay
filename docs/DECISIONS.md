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
