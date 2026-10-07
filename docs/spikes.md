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
| S06 | ~~Qwen 3.8 27B on the author's PC writes clear Polish briefs~~ | — | **Closed** — no AI (D-044) |
| S07 | FIT parsing in browser / server | Low | Unverified (Garmin FIT SDK has JS) |
| S08 | Smart-trainer control via Web Bluetooth (FTMS / ERG) | — | Deferred: out of scope v1 (D-009) |
| S09 | Readiness thresholds (02 M5.2) predict worse rides | Med | Designed; calibrate after the Learning Period with real data |
| S10 | Polar / Wahoo / COROS / Suunto / Whoop / Oura API eligibility | — | Deferred (personal tool) |
| S11 | Apple Health / Health Connect unreachable from web | Low | Believed true |
| S12 | GDPR: health data = special category (Art. 9) | Low | Mostly moot for a single-user tool; revisit if opened up |
| S13 | MyWhoosh ↔ intervals.icu: workouts arrive correctly (power targets, cadence, ramps); rides return with full data | Med | Research: exists; test with the author's account |
| S14 | Planned workouts written via the intervals.icu API reach Garmin Connect and MyWhoosh automatically | Med | **Delivery confirmed** (2026-10-02): a workout added by hand to the intervals.icu calendar reached the devices (author: "it works"). Still to check: the same via the API (from the phone app) |
| S15 | ~~Phone access via private tunnel~~ | — | **Closed** — phone-only app (D-043) |
| S16 | ~~Provenance of the community "uncensored" Qwen 3.8 build~~ | — | **Closed** — no AI (D-044) |
| S17 | ~~Book → local knowledge index~~ | — | **Closed** — not used; Method Notes only (D-044) |
| S18 | A same-morning Indoor/Outdoor switch reaches MyWhoosh and the watch in time | **High** | Unverified |
| S19 | Duplicate rides (watch + MyWhoosh both recording) double the Load | Med | Research: known problem; rule in 07 |
| S20 | ~~Web push from the PC over Tailscale~~ | — | **Closed** — reminder via iPhone Shortcut (D-045) |
| S21 | intervals.icu → Wahoo cloud → bike computer: planned workouts with HR targets arrive and display correctly | Med | Unverified |
| S22 | ~~Ollama for Windows on the author's GPU~~ | — | **Closed** — no AI (D-044) |
| S23 | One HR strap feeds both the bike computer and the watch at the same time (ANT+ vs Bluetooth) | Low | Unverified |
| S24 | ~~Windows Task Scheduler autostart~~ | — | **Closed** — no PC (D-043) |
| S25 | ~~LM Studio fallback~~ | — | **Closed** — no AI (D-044) |
| S26 | intervals.icu fields used by the code: `icu_weighted_avg_watts`, `icu_training_load`, wellness `hrv` / `restingHR` / `sleepSecs` / custom `BodyBatteryMax`, eFTP in `sportSettings`, best 1-min power for the ramp test | **High** | Mapped defensively (raw JSON kept); confirm on the first real sync |
| S27 | The installed PWA (GitHub Pages origin) can call the intervals.icu API: CORS preflight with the `Authorization` header on GET/POST/PUT/DELETE `/api/v1/` | **High** | Research: intervals.icu allows cross-origin `/api/v1/` requests; confirm on the phone (D-043) |
| S28 | Other-sport weights (D-047: run 0.6 / strength 0 in Fitness, full in Fatigue; leg-session thresholds 40 / 80 / 100) predict next-day bike readiness and ride quality | Med | Research-based starting values; calibrate after 6–8 weeks of the author's data |
| S29 | The activity streams endpoint `GET /api/v1/activity/{id}/streams.json?types=watts` returns the 1 Hz watts stream from the phone (CORS) in a shape the parser accepts (array of `{type, data}` or an object keyed by type) (D-063) | Med | Parser is defensive; demo verified. Confirm on the first real sync: Postęp › Profil mocy fills after a few rides with power |
| S30 | Coggan's women's power profile table: bottom ("untrained") values are approximate | Low | Shown as approximate; only affects the 0–100 bar and rider type for „Kobieta” |
| S31 | Google sign-in by redirect and the Drive copy work in the installed iPhone app with EveryDay's own OAuth client (D-068) | Low | The same mechanism works on the author's iPhone in Paragraf; verified here with a mock of Google. Confirm once the client exists |

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

## S06 — Local LLM on the author's PC (D-003) — closed (D-044)

- Options: WebLLM / transformers.js on WebGPU with a small model (1–4B
  params, 1–3 GB download), or Chrome's built-in Gemini Nano Prompt API.
- To verify: quality of the brief in EN/PL at that size; first-load download
  time; phone support (iOS Safari WebGPU); battery/heat.
- Second option, now preferred to evaluate: a native local runtime on the PC
  (Ollama / LM Studio / llama.cpp) exposing a localhost API. That allows
  bigger models (7–14B on an 8–16 GB GPU), but the PC must be on when the
  brief is generated.

## S06 notes — closed (D-044)

The v1 PC version planned a local Qwen 3.8 model via Ollama. Round 10
removed the AI entirely (D-044), so this research is no longer needed. The
author's hardware details were removed from the repo (D-046).

## S08 — Web Bluetooth trainer control

- Works in Chrome/Edge on desktop and Android; **not in iOS Safari**.
- Only needed if we play workouts in our own app (Q-WKD-01).

## S09 — Readiness without Body Battery

- Body Battery is Garmin-proprietary. Other users need an alternative:
  HRV (rMSSD) vs a 7-day/60-day baseline, resting HR deviation, sleep, load
  (Form) and the subjective Morning Check-in.
- Needs a baseline period (~1–2 weeks) before it is reliable.

## S18 — Same-morning Indoor/Outdoor switch

- MyWhoosh receives intervals.icu workouts for the next 7 days. How quickly
  does a change made at 07:00 for today appear in MyWhoosh? Same for Garmin
  Connect → the watch (it must sync).
- Fallback ideas: write **both variants** to the calendar for that day and
  label them clearly, or choose the variant the evening before.

## S19 — Duplicate rides

- intervals.icu merges duplicates only when start times line up. Garmin +
  MyWhoosh copies of the same indoor ride often don't, so Load is counted twice.
- Rule: one entry path per ride type; filter Garmin "VirtualRide" if the Fenix also records indoors.
- Source: [intervals.icu forum — duplicates from Garmin and MyWhoosh](https://forum.intervals.icu/t/duplicate-workouts-from-garmin-and-mywhoosh/125370).

## S20 — Web push through a private tunnel — closed (D-045)

- Service workers + Push API need HTTPS → Tailscale HTTPS certificates
  (or Tailscale Serve). The PC sends to the browser's push service
  (outbound only), so no public exposure is needed.
- iPhone: push only for a PWA added to the Home Screen (iOS 16.4+). Android
  Chrome: works in the browser.
