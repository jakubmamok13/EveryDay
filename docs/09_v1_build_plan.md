# 09 — v1 Build Plan

Status: **DRAFT** — Phase 0 defined; later phases after the remaining questions.

## Phase 0 — Setup and spikes (before any code)

### 0a. Author's checklist (D-032)

1. Create an **intervals.icu** account.
2. Link **Garmin Connect**: grant Activities + Wellness + Sleep scopes, tick
   "Download wellness data", and add custom wellness fields
   `BodyBatteryMin` / `BodyBatteryMax`.
3. Link **MyWhoosh** (workout sync + ride upload).
4. Link **Wahoo** (BOLT v2: workout sync + ride upload).
5. Add a filter so Garmin **VirtualRide** is ignored (D-024).
6. Set FTP 270 W, weight 86 kg, LTHR / max HR (Q-VIS-15).
7. Let it import history (Garmin backfill), so Fitness starts with real data.
8. Generate a personal **API key** (Settings → Developer).
9. On the PC: install **Ollama for Windows** and pull Qwen 3.8; install **Tailscale**
   on the PC and the phone.

### 0b. Spikes on the real setup

S05 (wellness fields) · S14 (calendar → Garmin / MyWhoosh / Wahoo) · S18
(same-morning switch) · S21 (BOLT v2 workouts) · S22 (Ollama on Windows +
RX 7800 XT speed) · S16 (uncensored build check) · S20 (web push on iOS +
Android via Tailscale) · S23 (HR strap on two devices).

## Later phases (draft, to be replaced)
- Phase 1: account + one Source + Activity import + Load/Fitness/Form.
- Phase 2: onboarding + Plan Engine (generate).
- Phase 3: Readiness + daily Adaptation + Daily Brief.
- Phase 4: workout export / delivery.
- Phase 5: polish, privacy, beta with friends.
