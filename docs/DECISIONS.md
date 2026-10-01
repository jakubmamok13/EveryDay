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

## D-003 · 2026-10-01 · Coach AI runs on the user's PC; app provides full technical detail ("book")
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

## D-005 · 2026-10-01 · v1 Goal types
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

## D-007 · 2026-10-01 · Brief and workout are delivered everywhere
- **Decision:** The Athlete reads the Daily Brief / today's workout on:
  **phone (morning)**, **PC browser**, **Garmin watch / Edge** (workout
  only), and a **pushed message (email / Telegram)**.
- **Consequence:** the app must be reachable from the phone, not only on
  the PC. Deployment shape 2 or 3 in 03_technical_architecture.md (Q-ARC-05).
- **Source:** User (round 2).

## D-008 · 2026-10-01 · Local AI runtime: native on a PC with an NVIDIA GPU (8 GB+)
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

## D-012 · 2026-10-01 · Deployment: everything on the author's PC (always on)
- **Decision:** Deployment shape **2**. App, database, sync, Plan Engine and
  Coach AI all run on the author's PC, which is on 24/7. The phone reaches the
  app through a **private tunnel** (e.g. Tailscale, no public exposure).
  Telegram / email messages are **sent out** from the PC.
  intervals.icu delivers workouts to Garmin and MyWhoosh (cloud side), so
  the devices work even if the PC is down.
- **Cost:** €0 hosting.
- **Consequence:** the brief is generated on a schedule (night / early
  morning), so a slow model is acceptable for the brief. Interactive chat
  speed depends on the GPU.
- **Source:** User (round 3).

## D-013 · 2026-10-01 · Language Polish; start with Qwen 3.8 "uncensored"
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
  (sleep quality, legs, motivation, sick yes/no; exact items TBD), in the app
  or by replying to the Telegram message with buttons.
- **Consequence:** the check-in is a first-class Readiness input next to
  Garmin wellness. The brief is finalized **after** the check-in (or at a
  cut-off time, Q-BRF-06).
- **Source:** User (round 4).

## D-016 · 2026-10-01 · Coach tone: friendly buddy
- **Decision:** The Daily Brief is **warm and motivating, still short**.
  Numbers come from the Plan Engine only.
- **Source:** User (round 4).
