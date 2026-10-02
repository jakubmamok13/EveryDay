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

## D-012 · 2026-10-01 · Deployment: everything on the author's PC (always on)
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

## D-013 · 2026-10-01 · Language Polish; start with Qwen 3.8 "uncensored" — *confirmed by D-026*
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

## D-017 · 2026-10-02 · AI hardware: AMD Radeon RX 7800 XT (16 GB) + 32 GB RAM (supersedes D-008)
- **Fact:** The author's GPU is an **AMD Radeon RX 7800 XT, 16 GB VRAM**
  (not NVIDIA, as assumed in D-008). The PC has **32 GB RAM**. OS: Q-ARC-10.
- **Decision:** Native local runtime: **Ollama** (ROCm or Vulkan backend), with
  **LM Studio / llama.cpp (Vulkan)** as fallback. No browser WebGPU.
- **Expectation (research, unverified on this PC):** a 27B model at ~4-bit
  (~13–17 GB) runs at roughly 15–25 tokens/s on an RX 7800 XT. That is
  usable for chat too. ROCm on Linux may need `HSA_OVERRIDE_GFX_VERSION=11.0.0`.
  Spike S06.
- **Source:** User (round 5) + research.

## D-018 · 2026-10-02 · One notification channel: web push from the app (supersedes D-007 push part)
- **Decision:** No Telegram, no email. The app sends **one browser push
  notification** ("alert from web") to the phone. Tapping it opens the
  **Today** screen with the Morning Check-in and the Daily Brief.
  The check-in is done **in the app** (D-015 updated).
- **Consequence:** the app is an installable **PWA** served over **HTTPS
  inside the private tunnel** (Tailscale certificates), because service
  workers and push require HTTPS. On iPhone, web push works only after the
  app is added to the Home Screen. Spike S20; phone type needed (Q-UX-04).
- **Source:** User (round 5).

## D-019 · 2026-10-02 · Coach Chat is in scope
- **Decision:** The Athlete can chat with the coach ("I only have 45 minutes
  today", "why this workout?"). Changes requested in chat go through the
  Safe Envelope (D-011) and are logged as Adaptations.
- **Open:** v1 or a later phase (decided in 09_v1_build_plan.md).
- **Source:** User (round 5: "that could be great").

## D-020 · 2026-10-02 · Indoor or outdoor is chosen each day
- **Decision:** The Athlete picks **Indoor / Outdoor each day** (part of the
  Morning Check-in, pre-filled with yesterday's guess). Each Planned
  Workout has **two variants**:
  - **Indoor:** power targets (ERG) for MyWhoosh on the Wahoo KICKR CORE.
  - **Outdoor:** HR (and RPE) targets for the Fenix 8, since there is no
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

## D-023 · 2026-10-02 · Outdoor: HR now, power later; Wahoo BOLT on the bike
- **Fact:** Outdoors the author has the **Fenix 8 + HR strap** and a
  **Wahoo ELEMNT BOLT** bike computer. There is **no power meter yet**, and
  one is planned.
- **Decision:** The Outdoor Variant uses **HR (+ RPE) targets** and HR-based
  Load. When outdoor rides start arriving **with power data**, the app offers
  to switch the Outdoor Variant to **power targets** (setting
  `outdoor_power_meter = yes`) and to re-check FTP outdoors vs indoors.
- **Open:** which device records outdoor rides and shows the workout:
  BOLT, Fenix or both (Q-INT-10). Both recording creates duplicates (S19).
- **Source:** User (round 6).

## D-024 · 2026-10-02 · Indoor rides: keep MyWhoosh's copy, ignore the Fenix copy
- **Fact:** Indoors **both MyWhoosh and the Fenix 8 record** the ride.
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

## D-026 · 2026-10-02 · Model confirmed: uncensored Qwen 3.8 (27B)
- **Decision:** Start with the **uncensored Qwen 3.8 27B** via Ollama (user
  choice after the clarity explanation). The clarity rules (D-021) still
  apply. The official Qwen 3.8 is kept as the configured **fallback** model.
- **Guardrails:** before first use, check the build's source, method and
  license (S16). The Plan Engine's Safe Envelope (D-011) protects training
  decisions regardless of the model.
- **Source:** User (round 6).
