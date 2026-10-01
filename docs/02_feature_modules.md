# 02 — Feature Modules

Status: **SKELETON** — modules are proposed; contents to be filled during the interview.

Each module lists: purpose, known requirements (from the user), proposals
(Claude, pending decision), and open questions.

---

## M1. Account & Profile

- Register / log in; data is stored on the account.
- Athlete profile: age, sex, weight, height, FTP, max/threshold/resting HR,
  equipment (power meter? smart trainer? HR strap? Garmin watch?).
- Proposal: support "unknown FTP" → estimate from history or a ramp test.

Open questions:
- **Q-ACC-01** Login method: email + password, magic link, Google, Strava
  login, Garmin login?
- **Q-ACC-02** Can the user delete the account and all data with one click? (GDPR says yes.)

## M2. Onboarding & Assessment

Known: asks **hours per week** and **Goal**.

Proposal — the onboarding questions (to confirm and extend):
1. Goal (type + optional event date + optional target, e.g. "FTP 280 W").
2. Weekly Availability: total hours; which days; max duration per day;
   indoor/outdoor per day.
3. Equipment: smart trainer / power meter / HR strap / watch.
4. Current fitness: imported history if a Source is connected, otherwise
   self-reported (years riding, typical week, last FTP test).
5. Limiters / preferences: weak points (climbing, sprint, endurance),
   preferred training days, strength training yes/no.
6. Health flags: injuries, conditions → disclaimer / "ask a doctor" gate.

Open questions:
- **Q-ONB-01** Max onboarding length you'd accept (e.g. 2 minutes / 10 questions)?
- **Q-ONB-02** Should a fitness test (ramp test / 20-min test) be part of week 1?

## M3. Data Sync (Sources)

Known: auto-import from Strava, Garmin, MyWhoosh, Zwift, "etc.".
**Important constraints found — see 07_integrations.md and spikes S01–S05.**

Open questions: see 07_integrations.md.

## M4. Plan Engine (plan generation)

Known: build a plan from hours/week + Goal.

Proposal:
- Periodized plan: Phases (Base → Build → Specialty/Peak → Taper) with
  Recovery Weeks (e.g. 3:1 or 2:1 loading).
- Distribution model per Goal and hours (polarized / pyramidal / sweet-spot).
- Workouts chosen from a **Workout Library** and scaled to FTP/zones and
  the day's time slot.
- **Deterministic and explainable** (rules + training-load math), not
  generated freely by an LLM. See 03_technical_architecture.md.

Open questions:
- **Q-PLN-01** Plan horizon: always to the event date? Rolling 4-week blocks
  when there is no event?
- **Q-PLN-02** Should the user be able to move/swap/skip workouts manually,
  and should the plan re-flow around that?
- **Q-PLN-03** Strength / mobility / stretching sessions included in the plan?
- **Q-PLN-04** Who writes the Workout Library — us (curated), the user, or both?

## M5. Daily Adaptation (Readiness)

Known: adjusts day by day to progress, Body Battery and "other details of
the human body and readiness".

Proposal — signals, in priority order:
- Training load: Fitness / Fatigue / Form (CTL/ATL/TSB-style), compliance
  with yesterday's plan, performance vs expected.
- Wellness from devices: HRV (vs personal baseline), resting HR, sleep
  duration/score, Body Battery (Garmin only), stress.
- **Morning Check-in** (subjective, ~10 seconds): sleep quality, legs,
  motivation, illness/soreness. Works for users without a wearable.
- Adaptation actions: keep / reduce intensity / shorten / swap to recovery /
  rest day / move key workout / (rarely) add.

Decided: rules adapt; the Coach AI may propose changes inside a safe
envelope, and the engine validates them (D-011). Changes apply
**automatically**, are explained in the brief, and can be undone with one tap (D-014).
A **daily Morning Check-in** is part of the routine (D-015).

Open questions:
- ~~Q-ADP-01~~ → D-014 (auto + tell + undo).
- **Q-ADP-04** Safe envelope for AI changes: is "±20% duration, same-type
  swap, ±1 day move, downgrade-only intensity" right?
- ~~Q-ADP-02~~ → D-015 (yes, daily).
- **Q-ADP-03** Missed workout: reschedule, drop, or ask?

## M6. Daily Brief (the "coach" message)

Known: a short description: what to focus on and what to do today to be
better prepared for training.

Proposal — structure (≤ 5 lines):
1. Today: workout name, duration, the ONE focus cue (e.g. "keep cadence 90+
   in the threshold blocks").
2. Why: one sentence linking to Readiness / plan phase.
3. Off-bike: one action (sleep, fueling, hydration, mobility).
4. Tomorrow preview.

Open questions:
- ~~Q-BRF-01~~ → D-007: phone, PC browser, Garmin (workout only),
  email / Telegram push.
- **Q-BRF-05** Push channel: Telegram, email, or both? At what time?
- **Q-BRF-06** Morning flow: check-in first, then brief? What happens if
  there is no check-in by a cut-off time?
- ~~Q-BRF-02~~ → D-016 (friendly buddy).
- **Q-BRF-03** Should the user be able to chat with the coach ("I only have
  45 minutes today")?
- **Q-BRF-04** Nutrition / fueling advice in scope (e.g. carbs per hour on long rides)?

## M7. Workout Delivery (getting the workout onto the bike) — DECIDED (D-009)

- Planned Workouts are written to the **intervals.icu calendar**.
- intervals.icu pushes them on: **Garmin Connect → watch / Edge** (outdoor)
  and **MyWhoosh** (indoor, rolling 7 days).
- When the plan adapts, the calendar entries are updated, so the devices
  get the new version.
- Fallback: download `.zwo` for manual MyWhoosh upload.
- Out of scope v1: Zwift; our own trainer control.

Open questions:
- **Q-WKD-02** Outdoor workouts: strict structured intervals on the Garmin,
  or "guidance" rides (e.g. "2 h Z2 with 3 climbs at threshold")?
- **Q-WKD-03** How does the plan choose indoor vs outdoor for a day: fixed
  per weekday, weather-based, or you decide each morning?

## M8. Progress & Insights

Proposal: Fitness/Fatigue/Form chart, FTP history, power-curve PRs, weekly
compliance, goal countdown. Kept secondary to the Daily Brief.

Open question:
- **Q-PRG-01** How much analytics do you want (minimal vs. intervals.icu-level)?

## M9. Notifications

Depends on Q-BRF-01.
