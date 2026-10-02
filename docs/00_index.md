# 00 — Index

Last updated: 2026-10-02

| Doc | Status | Notes |
|---|---|---|
| [README](README.md) | Done | Conventions |
| [01 Product vision](01_product_vision.md) | Draft | Personal tool, Polish, Coggan method |
| [02 Feature modules](02_feature_modules.md) | Draft | 10 modules (Coach Chat added) |
| [03 Technical architecture](03_technical_architecture.md) | Draft | All on PC; rules + AI adjust; runtime diagram |
| [04 Data model](04_data_model.md) | Skeleton | Entity list |
| [05 Settings](05_settings.md) | Skeleton | |
| [06 UX & interface](06_ux_interface.md) | Skeleton | |
| [07 Integrations](07_integrations.md) | Draft | intervals.icu hub decided |
| [08 Errors, logging, feedback](08_error_logging_feedback.md) | Skeleton | |
| [09 v1 build plan](09_v1_build_plan.md) | Draft | Phase 0 checklist + spikes |
| [Glossary](glossary.md) | Draft | ~35 terms, several *(proposed)* |
| [Spikes](spikes.md) | Draft | 23 spikes; S05, S06, S14, S16, S18, S22 high risk |
| [Decisions](DECISIONS.md) | Active | D-001 … D-036 (D-008 superseded) |

## Interview progress

- Round 0 — initial idea: captured in 01.
- Round 1 — scale, local AI, integrations, goals: **done** → D-002 … D-005.
- Round 2 — "book" meaning, where the brief is read, PC hardware, workout delivery: **done** → D-006 … D-009.
- Round 3 — method/book, who decides the plan, PC uptime, language: **done** → D-010 … D-013.
- Round 4 — adaptation mode, check-in, tone: **done** → D-014 … D-016.
- Round 5 — profile, devices, GPU, book, notifications, chat, indoor/outdoor, clarity: **done** → D-017 … D-022.
- Round 6 — outdoor power, indoor recording, phone, model: **done** → D-023 … D-026.
- Round 7 — days, weekend length, FTP / weight / goal, PC OS, outdoor recorder, intervals.icu, notifications: **done** → D-027 … D-032.
- Round 8 — long-ride target, notification time, coding, FTP updates: **done** → D-033 … D-036.
- Round 9 — approve or change the **proposed defaults** below: **waiting for the author**.

## Proposed defaults (round 9) — reply "OK" or change numbers

| # | Question | Proposed default |
|---|---|---|
| R8-01 | Q-VIS-01 name | Keep **EveryDay** |
| R8-02 | Q-ACC-01 login | Email + password, "remember this device"; onboarding runs for a new account |
| R8-03 | Q-ACC-02 data | Export all data + delete account in Settings |
| R8-04 | Q-ONB-01 onboarding | ≤ 10 questions (~3 min), pre-filled from intervals.icu |
| R8-05 | Q-ONB-02 first test | No test in week 1 (FTP 270 is recent); first test at the end of block 1 |
| R8-06 | Q-PLN-01 horizon | Rolling 4-week blocks; if an Event is added, periodize to its date |
| R8-07 | Q-PLN-02 manual moves | You can move / skip / swap; the rest of the week re-flows |
| R8-08 | D-033 long rides | One Long Ride Day (5–7 h) every 4–6 weeks, confirmed a week ahead + back-to-back weekends |
| R8-09 | Q-PLN-03 strength | No strength sessions in v1; off-bike tips only (mobility, sleep, fueling) |
| R8-10 | Q-PLN-04 library | Curated library (~40 workouts), each with indoor + outdoor variant |
| R8-11 | Q-ADP-03 missed workout | Key Workout → moved to the next free day this week if Form allows, else dropped; others dropped |
| R8-12 | Q-ADP-04 Safe Envelope | AI may: ±20% duration, same-type swap, ±1 day, easier only; never 2 hard days in a row |
| R8-13 | Q-INT-03 Readiness | Our own score (HRV, RHR, sleep, Body Battery, Form, check-in); Garmin's shown next to it |
| R8-14 | Q-INT-06 FIT upload | Yes, simple manual upload as a fallback |
| R8-15 | Q-BRF-04 nutrition | Fueling + hydration for rides > 90 min (carbs/h); no diet / weight-loss advice |
| R8-16 | Q-BRF-06 no check-in | Brief waits for the check-in; 2 h after the notification it uses Garmin data only and says so |
| R8-17 | Q-WKD-02 outdoor | Structured with HR ranges; long rides = guidance rides with fueling reminders |
| R8-18 | Q-PRG-01 analytics | Minimal: Fitness/Form, FTP + W/kg history, long-ride progress, weekly compliance |
| R8-19 | Q-CHT-01 chat memory | Important facts (injury, illness, travel) saved as notes with an end date; you can see and delete them |
| R8-20 | Q-ERR-01 ride rating | After each ride: RPE 1–10 + too easy / just right / too hard |
| R8-21 | Q-ARC-04 offline | Today's workout stays viewable offline (PWA cache) |
| R8-22 | Q-DAT-01 raw data | Keep all ride data forever (single user, small) |
| R8-23 | Q-UX-02/03 | Mobile-first; dark/light follows the phone |
| R8-24 | Q-VIS-15 LTHR | From Fenix 8 auto-detection or intervals.icu estimate; no extra test |
