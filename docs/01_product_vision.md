# 01 — Product Vision

Status: **DRAFT — rounds 1–4 answered**
Working name: **EveryDay** (repo name; final product name = Q-VIS-01)

## 1. One-line pitch

A free, **personal** web app (one user: the author, D-002) that acts as a
personal **cycling coach**. It builds a
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
| Readiness | Our daily score/state derived from Wellness + training load |
| Adaptation | A change the engine makes to the plan (and why) |
| Daily Brief | The short daily coaching message |

## 4. Who it's for — DECIDED (D-002)

**One user: the author.** A personal coaching tool. The data model stays
per-Athlete so it could be opened to friends later, but v1 makes no
compromises for other users.

Author's setup (devices, apps, hours, FTP): to be captured in Q-INT-02.

## 5. What makes it different (hypotheses to confirm)

- Free (competitors: TrainerRoad, TrainingPeaks, Xert, JOIN, Humango, Wahoo
  SYSTM, Zwift/MyWhoosh built-in plans; intervals.icu is free but is an
  analytics tool, not a coach).
- **Daily adaptation from body signals**, not only from completed workouts.
- **Brevity**: one screen, a few sentences, no dashboards required.
- **Privacy**: AI runs locally on the user's PC, so health data is never
  sent to a third-party AI provider (D-003).
- **Grounded in a method**: the Coach AI answers from a training book or
  method (D-006), not from generic internet knowledge.

## 6. Non-goals (proposed — confirm)

- Not a social network (no feed, kudos, leaderboards).
- Not a ride-recording app (Garmin/Zwift/MyWhoosh record; we read results).
- Not a medical device; no medical advice.
- v1: cycling only (no run/swim/triathlon).

## Open questions

- **Q-VIS-01** Final product name? (keep "EveryDay"?)
- ~~Q-VIS-02~~ → D-002 (only me).
- ~~Q-VIS-03~~ "Free" is moot for a personal tool. Target: €0 running cost.
- ~~Q-VIS-04~~ → D-003 (AI on user's PC).
- ~~Q-VIS-05~~ → D-005 (all four Goal types).
- ~~Q-VIS-06~~ Moot: the app is tuned to the author's equipment.
- ~~Q-VIS-07~~ → D-013: Polish.
- ~~Q-VIS-08~~ → D-007: phone browser + PC browser (+ Garmin, + pushed message).
  Native app: not planned.
- **Q-VIS-09** Who are the competitors you know / use today, and what do you
  like or hate about them?
- ~~Q-VIS-10~~ → D-006: the "book" is the Coach AI's knowledge source.
- ~~Q-VIS-11~~ → D-010: Allen & Coggan, "Training and Racing with a Power Meter".
- **Q-VIS-12** Do you have the book as an e-book/PDF (needed for the AI's
  knowledge base), or only on paper?
