# 01 — Product Vision

Status: **SPEC v1.1** — interview rounds 0–9 complete; phone-only since D-043
Name: **EveryDay** (R8-01)

## 1. One-line pitch

A free, **personal** web app (one user per phone, D-002) that acts as a
personal **cycling coach**. It runs **entirely on the phone** (D-043): no
server, no PC, no AI model, €0 running cost. It builds a
**Training Plan** from your **Weekly Availability** and **Goal**, then adapts
it each day to your **Readiness** and progress. Every morning it gives a short
**Daily Brief**: what to focus on today and what to do to be ready for the
next sessions.

## 2. What the user told us (source of truth, round 0)

- Free app for cycling training, **indoor and outdoor**.
- Runs **on the web**.
- Uses **local AI** to read/interpret the data.
- Data is saved to a **registered account**.
- Data is downloaded **automatically** from Strava, Garmin, MyWhoosh, Zwift, etc.
- At first start (onboarding) the app asks:
  - how many **hours per week** you can train → builds a training plan;
  - what your **Goal** is.
- **Day by day** the app adjusts the plan to: progress, Body Battery, and
  other signals of body state and readiness.
- Should feel like **the best coach**, but **brief**: a short description of
  which part of training to focus on and what to do each day.

Round 10 (after v1 was built): keeping a PC on all day makes no sense →
**phone only, free**, **no AI, buttons instead of text** (e.g. „Totalne
wyczerpanie”, „Czuję się gorzej”, „Choroba”, „W pełni sił”), reminder via an
**iPhone Shortcut**, and **no personal data in the public repo**
(D-043 – D-046).

## 3. Core concepts (see glossary.md for canonical definitions)

| Concept | Meaning in this app |
|---|---|
| Athlete | The registered user being coached |
| Goal | What the Athlete is training for (event, FTP, general fitness, …) |
| Weekly Availability | Hours per week + which days + indoor/outdoor per day |
| Training Plan | Multi-week structure of Phases → Weeks → Planned Workouts |
| Planned Workout | A structured session scheduled for a day |
| Activity | A completed ride imported from a Source |
| Wellness | Daily non-ride data: sleep, HRV, resting HR, Body Battery, check-in |
| Readiness | Our daily score (0–100) and state (green / yellow / red) from Wellness, Load and the Morning Check-in |
| Adaptation | A change the engine makes to the plan (and why) |
| Daily Brief | The short daily coaching message |

## 4. Who it's for — DECIDED (D-002)

**One athlete per phone.** A personal coaching tool: each person installs
the app on their own phone and their data stays there. The data model stays
per-Athlete.

Personal details (weight, FTP, schedule, devices) are **not** kept in this
repository (D-046). They are entered in onboarding and stored only on the phone.

### Reference setup (what v1 is tuned for)

| Item | Example |
|---|---|
| Training days | 3–4 days a week, ~1 h on weekdays, longer at the weekend (+ an optional Bonus Day, D-027) |
| Watch | A **Garmin** watch with HRV, sleep and Body Battery |
| HR | Chest HR strap (optional) |
| Indoor | A smart trainer with **MyWhoosh** (ERG) |
| Bike computer | A **Wahoo** bike computer outdoors (Master Copy, D-029); the watch is the fallback |
| Outdoor power meter | Optional → without one, outdoor rides are HR-guided (D-023) |
| Phone | **iPhone** or Android (D-025); installed from the browser to the Home Screen |
| Goal | Primary **Raise FTP** + Secondary **long rides** (D-028, D-033) |
| Data hub | **intervals.icu** (free account, D-004) |

### Example Power Zones (Coggan) at FTP 250 W

| Zone | % FTP | Watts |
|---|---|---|
| Z1 Active Recovery | < 55% | < 138 |
| Z2 Endurance | 56–75% | 140–188 |
| Z3 Tempo | 76–90% | 190–225 |
| *Sweet Spot* | 88–94% | 220–235 |
| Z4 Lactate Threshold | 91–105% | 228–263 |
| Z5 VO2max | 106–120% | 265–300 |
| Z6 Anaerobic Capacity | 121–150% | 303–375 |
| Z7 Neuromuscular | > 150% | > 375 |

HR zones for outdoor rides use **LTHR** from the watch / intervals.icu (R8-24).

## 5. What makes it different (hypotheses to confirm)

- Free (competitors: TrainerRoad, TrainingPeaks, Xert, JOIN, Humango, Wahoo
  SYSTM, Zwift/MyWhoosh built-in plans; intervals.icu is free but is an
  analytics tool, not a coach).
- **Daily adaptation from body signals**, not only from completed workouts.
- **Brevity**: one screen, a few sentences, no dashboards required.
- **Privacy**: everything runs on the phone (D-043). Health data goes only
  between the phone and the user's own intervals.icu account; no AI provider,
  no server of ours.
- **Grounded in a method**: rules and short Method Notes based on the
  Allen & Coggan approach (D-010, D-022), not generic internet advice.
- **No typing**: one-tap check-in and buttons instead of a chat (D-044).

## 6. Non-goals (v1)

- Not a social network (no feed, kudos, leaderboards).
- Not a ride-recording app (MyWhoosh, BOLT and Fenix record; we read results).
- Not a medical device; no medical, diet or weight-loss advice (R8-15).
- No AI model and no free-text chat (D-044).
- No strength sessions (R8-09), no Zwift, no own trainer control (D-009).
- Cycling only (no run / swim / triathlon).

## Open questions

- ~~Q-VIS-01~~ → EveryDay (R8-01).
- ~~Q-VIS-02~~ → D-002 (only me).
- ~~Q-VIS-03~~ Target: €0 running cost → met by D-043 (static hosting, phone-only).
- ~~Q-VIS-04~~ → D-003 (AI on user's PC), later superseded by D-043/D-044 (no AI, phone only).
- ~~Q-VIS-05~~ → D-005 (all four Goal types).
- ~~Q-VIS-06~~ Moot: the app is tuned to the reference setup above.
- ~~Q-VIS-07~~ → D-013: Polish.
- ~~Q-VIS-08~~ → D-007, now D-043: the phone (installed web app). Native app: not planned.
- **Q-VIS-09** (optional) Competitors you use or know, and what you like or hate about them.
- ~~Q-VIS-10~~ → D-006: the "book" is the Coach AI's knowledge source.
- ~~Q-VIS-11~~ → D-010: Allen & Coggan, "Training and Racing with a Power Meter".
- ~~Q-VIS-12~~ Book not found yet → D-022 (start with our own Method Notes).
- ~~Q-VIS-13~~ → D-027 (set in onboarding).
- ~~Q-VIS-14~~ → onboarding profile + D-028.
- ~~Q-VIS-15~~ → R8-24: LTHR / max HR from the watch's auto-detection or intervals.icu.
- ~~Q-VIS-16~~ → D-033: 200 km+ / 7 h+.
