# 09 — v1 Build Plan

Status: **SPEC v1**. Each phase ends with something **usable** and an exit
test the author can check on the phone. The AI comes after the rule-based
daily loop works, so the app is useful even if the AI spike disappoints.

## Phase 0 — Setup and spikes (before any code)

### 0a. Author's checklist (D-032)

1. Create an **intervals.icu** account.
2. Link **Garmin Connect**: grant Activities + Wellness + Sleep scopes, tick
   "Download wellness data", and add custom wellness fields
   `BodyBatteryMin` / `BodyBatteryMax`.
3. Link **MyWhoosh** (workout sync + ride upload).
4. Link **Wahoo** (BOLT v2: workout sync + ride upload).
5. Add a filter so Garmin **VirtualRide** is ignored (D-024).
6. Set FTP 270 W, weight 86 kg, LTHR / max HR (R8-24).
7. Let it import history (Garmin backfill), so Fitness starts with real data.
8. Generate a personal **API key** (Settings → Developer).
9. On the PC: install **Ollama for Windows** and pull Qwen 3.8 (uncensored);
   install **Tailscale** on the PC and the phone.
10. Look for the Coggan & Allen book (optional; Method Notes come first).

### 0a progress (2026-10-02)

| Step | Status |
|---|---|
| 1. intervals.icu account | ✔ done (API key created) |
| 2–4. Link Garmin / MyWhoosh / Wahoo | ✔ done (2026-10-02) |
| 5. VirtualRide filter | ? to confirm |
| 6–7. FTP / weight / history import | ? to confirm |
| S14 test workout | Author approved one "TEST EveryDay" workout (20 min easy), deleted after the check |
| 8. API key | ✔ done. Shared in chat → **regenerate it after Phase 0**; the app stores its own copy encrypted (03 §7). Never committed. |
| 9. Tailscale | ✔ phone · ✖ PC (no access to the PC right now) |
| 9. Ollama on the PC | ✖ waiting for PC access |

Blocked from the Claude cloud session: `intervals.icu` is not in the
session environment's allowed network domains, so S05 / S14 cannot run until
it is added (a setting of the Claude environment, not of the app).

### 0b. Spikes on the real setup (Claude, with the author's help)

| Spike | Question | Exit |
|---|---|---|
| S05 | Wellness + activity fields via the API (HRV, Body Battery, readiness, load, eFTP) | Field map written into 07 |
| S14 | A workout written via the API arrives in MyWhoosh, on the BOLT v2 and on the Fenix 8 | Seen on all three |
| S18 | Same-morning swap indoor ↔ outdoor arrives in time | Delay measured; fallback chosen if needed |
| S21 | BOLT v2 shows HR-target steps correctly | Photo of the BOLT screen |
| S22 + S16 | Ollama on Windows + RX 7800 XT runs the uncensored Qwen 3.8: speed, Polish quality, source check | ≥ 10 tok/s, 10 sample briefs reviewed by the author |
| S20 | Web push via the Tailscale HTTPS PWA on iPhone **and** Android | Test notification received on both |
| S23 | HR strap on BOLT + Fenix at the same time | Both recordings have HR |

Spike results update the docs (confirmed → architecture; problem → DECISIONS).

## Phase 1 — Foundation

- Repository scaffold (03 §4), TypeScript build, tests.
- Windows service with auto-start; Tailscale HTTPS; PWA shell (installable).
- Login + "remember this device" (R8-02).
- SQLite schema (04) + migrations; nightly backup.
- intervals.icu sync: activities (+ FIT), wellness; duplicates guard + Master Copy.
- Load, Fitness, Fatigue, Form.
- Status page.

**Exit:** on the phone, Today shows yesterday's rides, wellness and Form,
with numbers matching intervals.icu (± rounding).

## Phase 2 — Plan Engine and delivery

- Workout Library v1 (~40 workouts, indoor + outdoor variants).
- Onboarding (≤ 10 screens) with intervals.icu pre-fill.
- Plan generation: rolling 4-week blocks, the author's weekly template,
  event periodization.
- Calendar writes (default Ride Mode per weekday), delivery status, `.zwo` fallback.
- Week screen: move / skip / swap with re-flow.
- Engine unit tests + a **12-week simulation** (checks ramp cap, recovery
  weeks, no two hard days in a row).

**Exit:** the next 7 days of real workouts are in MyWhoosh, on the BOLT v2
and on the Fenix 8; a manual move updates the devices.

## Phase 3 — Daily loop (no AI yet)

- Morning Check-in incl. Ride Mode; Ride Rating.
- Readiness (with Learning Period) + Adaptation rules + Undo.
- Web push at the per-day time, every day; Today screen states.
- **Template brief** (all slots from templates).
- Ride matching, compliance, Progression ±1 step, missed-workout rule.
- Bonus Day.

**Exit:** 2 weeks of real daily use: a notification every morning, a correct
brief, and adaptations that make sense to the author.

## Phase 4 — Coach AI

- Ollama client, prompts (Polish), JSON output, validator, template fallback.
- **Method Notes** (Polish, in git) + Knowledge Base index (embeddings).
- AI slots in the brief; AI proposals via the Safe Envelope.

**Exit:** 7 consecutive AI briefs pass the validator, and the author rates them clear.

## Phase 5 — Coach Chat

- Chat screen with streaming; quick chips.
- Change requests → proposals → engine → Undo.
- Chat Notes (create, end date, list, delete) feeding Readiness and planning.

**Exit:** "mam tylko 45 min", "boli mnie kolano" and "dlaczego ten trening?"
all work as specified in 02 M10.

## Phase 6 — Progress, FTP, long rides, data

- Progress screen (R8-18).
- eFTP suggestions + ramp test in the Recovery Week (M12).
- Long Ride Day proposals + confirmation; fueling lines (M13).
- Export ZIP, delete account, backup second location.

**Exit:** a full 4-week block runs end to end with a ramp test and an FTP update.

## v1 = Phases 0–6 complete

## Later (not v1)

Outdoor power meter switch-over polish (when bought) · book indexing (when
found) · strength sessions · Zwift · own trainer control · Strava ·
multi-user · English UI.

## Testing approach

- **Engine:** unit tests for every rule + golden-file tests (fixed input →
  expected plan) + the 12-week simulation.
- **Coach:** a fixed set of 20 fact scenarios (green / yellow / red / sick
  / long ride / rest day) → validator must pass; the author reviews the
  texts when the model or prompt changes.
- **Integration:** a recorded intervals.icu sandbox (saved API responses) so
  tests run without the real account.
