# Spikes — unverified assumptions

Each spike ends as: **Confirmed** (moved into the relevant doc),
**Problem** (becomes a decision in DECISIONS.md), or **Deferred** (stays here
with a note). "Research" means desk research from web sources dated
2026-10-01. That is not the same as verified: we must read the official
terms and test the APIs ourselves.

| ID | Assumption / question | Risk | Status |
|---|---|---|---|
| S01 | Strava API usable for a free coaching app with AI | — | **Deferred** — not used in v1 (D-004) |
| S02 | Garmin Connect API (Body Battery, HRV, sleep) obtainable | — | **Deferred** — data comes via intervals.icu (D-004) |
| S03 | Zwift data reachable | Med | Research: indirect only |
| S04 | MyWhoosh data reachable; workout import format | Med | Research: **direct intervals.icu integration** both ways |
| S05 | intervals.icu usable as a data hub for a third-party app | **High** | Research: promising; test with the author's account |
| S06 | Qwen 3.8 (uncensored) on the author's NVIDIA PC writes good **Polish** briefs grounded in the book (RAG), fast enough | **High** | Unverified |
| S07 | FIT parsing in browser / server | Low | Unverified (Garmin FIT SDK has JS) |
| S08 | Smart-trainer control via Web Bluetooth (FTMS / ERG) | — | Deferred: out of scope v1 (D-009) |
| S09 | Readiness model: how to combine Body Battery, Garmin Training Readiness, HRV, RHR, sleep, Load, Check-in | Med | Design work |
| S10 | Polar / Wahoo / COROS / Suunto / Whoop / Oura API eligibility | — | Deferred (personal tool) |
| S11 | Apple Health / Health Connect unreachable from web | Low | Believed true |
| S12 | GDPR: health data = special category (Art. 9) | Low | Mostly moot for a single-user tool; revisit if opened up |
| S13 | MyWhoosh ↔ intervals.icu: workouts arrive correctly (power targets, cadence, ramps); rides return with full data | Med | Research: exists; test with the author's account |
| S14 | Planned workouts written via the intervals.icu API reach Garmin Connect and MyWhoosh automatically | **High** | Unverified — core of the delivery path |
| S15 | Phone access via private tunnel + Telegram/email push from the PC | Low | Decided D-012; setup to verify |
| S16 | Provenance / license / quality of the community "uncensored" Qwen 3.8 build | Med | Unverified |
| S17 | Book → local knowledge index: format of the author's copy (PDF/e-book), Polish answers from an English book | Med | Unverified |

## S01 — Strava API

Research findings:
- Nov 2024 API agreement: third-party apps may show an athlete's Strava data
  **only to that athlete**. Strava data may not be used "in AI models or
  similar applications". It is unclear whether **inference** on the athlete's
  own data for that athlete counts. Needs a legal reading.
- Jun 2026: Standard-tier developers need a paid Strava subscription
  (~$11.99/mo US). New apps get 1 athlete, can raise that to 10 without
  review, and need approval for more than 10.
- Sources: [Strava press — API agreement update](https://press.strava.com/articles/updates-to-stravas-api-agreement),
  [Strava support — how data appears on 3rd-party apps](https://support.strava.com/en-us/articles/15401608-api-agreement-update-how-data-appears-on-3rd-party-apps),
  [Terra — Strava API changes 2026](https://tryterra.co/blog/strava-api-changes-2026),
  [appsforstrava — developer program changes 2026](https://appsforstrava.com/blog/strava-developer-program-changes-2026).
- To verify: current official API Agreement text; whether an "AI coach" is
  allowed; review criteria for more than 10 athletes.

## S02 — Garmin Connect Developer Program

Research findings:
- Legal entities only (company / university / institution); individuals are rejected.
- Reported **paused for new applications** in 2026, with no reopening date.
- Body Battery, sleep, HRV, stress and RHR are in the Health API. Data is
  removed from the API 7 days after delivery, so it must be persisted on arrival.
- Training API can push workouts and plans to devices.
- A ~$5,000 production fee is cited by third parties; unverified.
- Sources: [wearable-api-field-guide — Garmin](https://github.com/antsal06/wearable-api-field-guide/blob/main/providers/garmin.md),
  [Open Wearables — Garmin API guide](https://openwearables.io/blog/garmin-connect-api-developer-guide-activities-health-metrics).
- Unofficial libraries that log in as the user exist. They break Garmin's
  ToS and break often. **Not acceptable for a public app.**

## S03 — Zwift

- No public API; partners only; "not able to offer developer accounts to
  hobby developers".
- Zwift auto-uploads to Garmin Connect, Strava, TrainingPeaks,
  intervals.icu (to verify) and others.
- Source: [Zwift forums — API for 3rd-party sync](https://forums.zwift.com/t/api-for-3rd-party-app-sync-zwift-activities/655226),
  [Zwift support — third-party platforms](https://support.zwift.com/en_us/zwift-and-third-party-platforms-SypU0LdVr).

## S04 — MyWhoosh

- No public API found.
- **intervals.icu integration is live:** link MyWhoosh in intervals.icu
  settings; workouts for the next 7 days sync to MyWhoosh; completed rides
  sync back. Reported issues: cadence targets, lap data (fixed in MyWhoosh 5.x).
- Also accepts `.zwo` uploads via workout.mywhoosh.com (manual fallback).
- Sources: [intervals.icu forum — MyWhoosh integration (p.3)](https://forum.intervals.icu/t/mywhoosh-integration/79532?page=3),
  [MyWhoosh 5.0.0 release notes](https://mywhoosh.com/mywhoosh-5-0-0-is-out-now/),
  [forum — export icu workout to MyWhoosh](https://forum.intervals.icu/t/how-to-export-a-icu-workout-to-mywhoosh/112558),
  [intervals.icu forum — MyWhoosh integration](https://forum.intervals.icu/t/mywhoosh-integration/79532),
  [intervals.icu forum — MyWhoosh plan sync](https://forum.intervals.icu/t/mywhoosh-training-plan-synchro/124179).
- To verify (S13): do intervals.icu workouts land in MyWhoosh with correct
  ERG targets, ramps and cadence cues?

## S05 — intervals.icu as hub

- Open REST API, per-user API key and OAuth, webhooks, wellness endpoints,
  calendar and workout endpoints.
- Research (2026-10-01): Garmin wellness sync delivers HRV, resting HR,
  sleep stages, **Body Battery** (enable "Download wellness data" + custom
  wellness fields `BodyBatteryMin` / `BodyBatteryMax`) and **Garmin Training
  Readiness**, within ~5 min of a watch sync. Garmin scopes for Wellness and
  Sleep must be granted.
- Research: **Strava-sourced activities are returned as stubs** by the
  intervals.icu API, so link Garmin, Zwift and MyWhoosh directly.
- Sources: [intervals.icu Open API](https://www.intervals.icu/features/open-api/),
  [forum: Strava privacy update](https://forum.intervals.icu/t/strava-privacy-update-nov24/79940),
  [forum: Body Battery](https://forum.intervals.icu/t/solved-hrv-tracking-via-garmin-body-battery/36154),
  [stas.run: intervals.icu ↔ Garmin sync](https://stas.run/en/guides/intervals-icu-garmin-sync).
- Still to verify with the author's real account: field names and units
  in the wellness API; history depth on first import; rate limits; writing
  planned workouts and their delivery to Garmin and Zwift.

## S06 — Local LLM on the author's PC (D-003)

- Options: WebLLM / transformers.js on WebGPU with a small model (1–4B
  params, 1–3 GB download), or Chrome's built-in Gemini Nano Prompt API.
- To verify: quality of the brief in EN/PL at that size; first-load download
  time; phone support (iOS Safari WebGPU); battery/heat.
- Second option, now preferred to evaluate: a native local runtime on the PC
  (Ollama / LM Studio / llama.cpp) exposing a localhost API. That allows
  bigger models (7–14B on an 8–16 GB GPU), but the PC must be on when the
  brief is generated.

## S06 notes — model candidates (to test)

- **First: Qwen 3.8 27B, uncensored variant** (user choice, D-013). Research
  2026-10-01: released Aug 14 2026, Apache-2.0, in Ollama since v0.32.12.
  Default tag q4_K_M is an ~18 GB download, recommended for 24 GB+ VRAM, with
  a 256K context (Ollama's default context setting truncates long inputs,
  so set `num_ctx` explicitly). On 8–16 GB VRAM it partly runs on the CPU:
  measure speed.
  Sources: [Ollama announcement](https://x.com/ollama/status/2088314436088168491),
  [Qwen (Wikipedia)](https://en.wikipedia.org/wiki/Qwen),
  [Ollama library tag](https://ollama.com/library/qwen3.8:27b-mlx).
- Fallbacks: **Bielik** (Polish-native), official Qwen 3.8, smaller models.
- Test: same input facts → brief; score accuracy (no invented numbers),
  brevity and tone. Also test RAG retrieval quality over the chosen book.

## S08 — Web Bluetooth trainer control

- Works in Chrome/Edge on desktop and Android; **not in iOS Safari**.
- Only needed if we play workouts in our own app (Q-WKD-01).

## S09 — Readiness without Body Battery

- Body Battery is Garmin-proprietary. Other users need an alternative:
  HRV (rMSSD) vs a 7-day/60-day baseline, resting HR deviation, sleep, load
  (Form) and the subjective Morning Check-in.
- Needs a baseline period (~1–2 weeks) before it is reliable.
