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
| S06 | Qwen 3.8 27B on the author's **AMD RX 7800 XT 16 GB** writes clear **Polish** briefs and chats fast enough | **High** | Research: ~15–25 tok/s expected; test on the PC |
| S07 | FIT parsing in browser / server | Low | Unverified (Garmin FIT SDK has JS) |
| S08 | Smart-trainer control via Web Bluetooth (FTMS / ERG) | — | Deferred: out of scope v1 (D-009) |
| S09 | Readiness thresholds (02 M5.2) predict worse rides | Med | Designed; calibrate after the Learning Period with real data |
| S10 | Polar / Wahoo / COROS / Suunto / Whoop / Oura API eligibility | — | Deferred (personal tool) |
| S11 | Apple Health / Health Connect unreachable from web | Low | Believed true |
| S12 | GDPR: health data = special category (Art. 9) | Low | Mostly moot for a single-user tool; revisit if opened up |
| S13 | MyWhoosh ↔ intervals.icu: workouts arrive correctly (power targets, cadence, ramps); rides return with full data | Med | Research: exists; test with the author's account |
| S14 | Planned workouts written via the intervals.icu API reach Garmin Connect and MyWhoosh automatically | Med | **Delivery confirmed** (2026-10-02): a workout added by hand to the intervals.icu calendar reached the devices (author: "it works"). Still to check: the same via the API (Phase 1, on the PC) |
| S15 | Phone access via private tunnel + Telegram/email push from the PC | Low | Decided D-012; setup to verify |
| S16 | Provenance / license / quality of the community "uncensored" Qwen 3.8 build — **chosen model (D-026)** | **High** | Unverified |
| S17 | Book → local knowledge index: format of the author's copy (PDF/e-book), Polish answers from an English book | Low | Deferred: book not found yet; Method Notes first (D-022) |
| S18 | A same-morning Indoor/Outdoor switch reaches MyWhoosh and the Fenix 8 in time | **High** | Unverified |
| S19 | Duplicate rides (Fenix + MyWhoosh both recording) double the Load | Med | Research: known problem; rule in 07 |
| S20 | Web push to the phone from a PWA served by the PC over the Tailscale tunnel (HTTPS certs, iOS Home Screen rule) — **iOS and Android** (D-025) | Med | Unverified |
| S21 | intervals.icu → Wahoo cloud → ELEMNT **BOLT v2**: planned workouts with HR targets arrive and display correctly | Med | Unverified |
| S22 | Ollama for **Windows** runs Qwen 3.8 27B on the **RX 7800 XT** (ROCm/HIP), or LM Studio Vulkan as fallback; measure tokens/s | **High** | Unverified |
| S23 | One HR strap feeds both BOLT v2 and Fenix 8 at the same time (ANT+ vs Bluetooth) | Low | Unverified |
| S24 | Windows Task Scheduler autostart (S4U) runs `npm start` before login and restarts it | Med | Script written; verify on the PC |
| S25 | LM Studio fallback (OpenAI-compatible API) | Low | Deferred: app speaks Ollama API; templates work without AI |
| S26 | intervals.icu fields used by the code: `icu_weighted_avg_watts`, `icu_training_load`, wellness `hrv` / `restingHR` / `sleepSecs` / custom `BodyBatteryMax`, eFTP in `sportSettings`, FIT download path, best 1-min power for the ramp test | **High** | Mapped defensively (raw JSON kept); confirm on the first real sync |

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
- **Author's hardware (D-017): AMD RX 7800 XT 16 GB + 32 GB RAM.** Research:
  27B models at Q4 (~17 GB) run at ~15–25 tok/s with slight offload; ~13 GB
  4-bit quants fit fully at ~19 tok/s. ROCm works unofficially on the
  7800 XT (`HSA_OVERRIDE_GFX_VERSION=11.0.0` on Linux); Vulkan is an alternative.
  Sources: [RX 7800 XT local LLM guide](https://godinim.github.io/2026/local-llm-guide-AMD-RX-7800-XT),
  [RX 7800 XT llama.cpp benchmarks](https://sergiiob.dev/posts/rx7800-xt-llama-cpp-benchmarks-moe-context/),
  [llama.cpp ROCm discussion](https://github.com/ggml-org/llama.cpp/discussions/15021).
- Clarity (D-021) must come from prompt + template + validator, not from
  the "uncensored" variant.
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

## S18 — Same-morning Indoor/Outdoor switch

- MyWhoosh receives intervals.icu workouts for the next 7 days. How quickly
  does a change made at 07:00 for today appear in MyWhoosh? Same for Garmin
  Connect → Fenix 8 (the watch must sync).
- Fallback ideas: write **both variants** to the calendar for that day and
  label them clearly, or choose the variant the evening before.

## S19 — Duplicate rides

- intervals.icu merges duplicates only when start times line up. Garmin +
  MyWhoosh copies of the same indoor ride often don't, so Load is counted twice.
- Rule: one entry path per ride type; filter Garmin "VirtualRide" if the Fenix also records indoors.
- Source: [intervals.icu forum — duplicates from Garmin and MyWhoosh](https://forum.intervals.icu/t/duplicate-workouts-from-garmin-and-mywhoosh/125370).

## S20 — Web push through a private tunnel

- Service workers + Push API need HTTPS → Tailscale HTTPS certificates
  (or Tailscale Serve). The PC sends to the browser's push service
  (outbound only), so no public exposure is needed.
- iPhone: push only for a PWA added to the Home Screen (iOS 16.4+). Android
  Chrome: works in the browser.
