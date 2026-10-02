# 02 — Feature Modules

Status: **SPEC v1** — all interview decisions applied (D-001 … D-037).
Rules marked *(our rule)* are not taken from the book; they are our own
choices and are tuned after the first weeks of real use.

Modules:
M1 Account & Profile · M2 Onboarding · M3 Data Sync · M4 Plan Engine ·
M5 Readiness & Adaptation · M6 Daily Brief · M7 Workout Delivery ·
M8 Progress · M9 Notifications · M10 Coach Chat · M11 Knowledge Base ·
M12 FTP Management · M13 Long Rides & Fueling

---

## M1. Account & Profile

**Purpose:** one protected account for the author; the data model stays
multi-account-ready (D-002).

- Login: **email + password**, "remember this device" (long-lived device
  session). Reachable only inside the private tunnel (D-012). (R8-02)
- Creating a **new account** runs Onboarding (M2). The Goal can be set again
  there, or changed later in Settings for the existing account (D-028).
- **Profile:** weight, height, FTP, LTHR, max HR, outdoor power meter
  yes/no, equipment list. Physiology values are **versioned**: every change
  creates a Fitness Snapshot with a date and a source (test, eFTP accepted,
  manual, Fenix). Old rides keep the values that were valid on their date.
- **Data:** export everything (ZIP: JSON + FIT files) and delete the account
  from Settings. (R8-03)

## M2. Onboarding

**Purpose:** a plan in ~3 minutes, with **≤ 10 screens**, pre-filled from
intervals.icu (R8-04).

| # | Screen | Pre-filled from |
|---|---|---|
| 1 | Create account (email, password) | — |
| 2 | Connect intervals.icu (athlete ID + API key, "Test") | — |
| 3 | Profile: weight, height, FTP, LTHR, max HR | intervals.icu |
| 4 | Primary Goal (Raise FTP / Endurance / Event / General fitness) | — |
| 5 | Secondary Goal (optional) + target (e.g. 200 km / 7 h) | — |
| 6 | Event (optional): name, date, priority A/B/C | — |
| 7 | Weekly Availability: per weekday available?, max minutes, default Ride Mode | — |
| 8 | Equipment: trainer, bike computer, watch, HR strap, power meter | intervals.icu connections |
| 9 | Notifications: time per day + enable push (iPhone: "Add to Home Screen" guide) | default 07:00 |
| 10 | Health: current injury or illness? → saved as a Chat Note | — |

Result: a **plan preview** (next 4 weeks) → "Start".

- **No fitness test in week 1**: FTP 270 W is recent. The first test is at
  the end of block 1 (R8-05).
- History import: Fitness and Fatigue start from the imported history, so
  the first plan is scaled to real current Load.

## M3. Data Sync

**Purpose:** get rides and wellness from intervals.icu and send planned
workouts back (D-004, D-009). Details: 07_integrations.md.

- **In:** activities (MyWhoosh indoor, BOLT v2 + Fenix 8 outdoor), wellness
  (HRV, resting HR, sleep, Body Battery min/max, Garmin Training Readiness,
  weight), FIT files.
- **Out:** the chosen Workout Variant for each Planned Workout, written to
  the intervals.icu calendar. intervals.icu then pushes it to MyWhoosh,
  Garmin (Fenix 8) and Wahoo (BOLT v2).
- **Master Copy rule** (D-024, D-029): every ride counts once.
  Indoors = MyWhoosh copy. Outdoors = BOLT copy, with the Fenix copy as
  fallback. Duplicate guard: same day + overlapping time + duration within
  15% → the non-master copy is marked `duplicate_of` and gets no Load.
- **Manual FIT upload** as a fallback (R8-14).

## M4. Plan Engine

**Purpose:** build and maintain the Training Plan from Goal + Weekly
Availability + current Fitness, following the Coggan & Allen method
(D-010). It is deterministic: the same input always gives the same plan.

### 4.1 Structure

- **Rolling 4-week blocks** (R8-06): 3 load weeks + 1 Recovery Week.
  Recovery Week Load ≈ 55–65% of a load week *(our rule)*.
- **Block Focus** rotates for the Raise FTP goal *(our rule)*:
  Sweet Spot → Threshold → VO2max (+ Threshold) → repeat, at the new FTP.
- **Fitness ramp cap:** planned Fitness rise ≤ **+5 per week** *(our rule;
  common guidance is 3–8)*.
- **Intensity distribution:** pyramidal: most time in Z2, some Z3 / Sweet
  Spot, little Z4–Z5. Fits 4–10 h/week.
- **With an Event** (Goal type Event): periodize backwards from the date:
  Base → Build → Peak → Taper (7–10 days), aiming for Form **+15 to +25** on
  event day (Coggan Performance Manager guidance).

### 4.2 The author's weekly template (D-027, D-028, D-033)

| Day | Max | Role | Content |
|---|---|---|---|
| Mon | 1 h | **Key Workout 1** | Quality session of the Block Focus (usually indoor, ERG) |
| Wed | 1 h | **Key Workout 2** | Quality session of the Block Focus |
| Sat | ≤ 4 h | **Key Workout 3: long ride** | Z2 with Tempo / Sweet Spot segments in later weeks; grows toward the long-ride target |
| Sun | ≤ 4 h (default 2–2.5 h) | Back-to-back endurance | Z2; Tempo only if Form allows |
| Other days | — | Rest | Bonus Day possible (M5.6) |

- Recovery Week: Mon easy spin, **Wed ramp test** (M12), Sat/Sun Z2 shorter.
- **Never two hard days in a row** (Sun endurance counts as not hard).
- Workouts are chosen from the Workout Library (4.4) and **scaled** to FTP
  (indoor) / LTHR (outdoor) and to the day's max minutes.

### 4.3 Manual changes (R8-07)

- The Athlete can **move, skip or swap** any Planned Workout (Week screen).
- After a change the rest of the week **re-flows**: Key Workouts are
  protected first, and a warning appears if the result has two hard days in a row.
- Changing the **Goal** or **Availability** regenerates the plan **from
  today**; history, Fitness and completed rides are kept (D-028).

### 4.4 Workout Library (R8-10)

- **~40 curated workouts**, written by us from the method, stored as data
  files in the repo (`library/workouts/`).
- Categories: Recovery · Endurance · Tempo · Sweet Spot · Threshold ·
  VO2max · Anaerobic / Sprint (few) · Tests (ramp, 20 min) · Long Ride templates.
- Each workout has: Polish name, purpose, one **focus cue**, **Indoor
  Variant** (steps in % FTP, cadence cues), **Outdoor Variant** (HR zone +
  RPE per step, or loose guidance for long rides), scalable parameters
  (reps, step length), intensity class (easy / moderate / hard), estimated Load.
- **No strength sessions in v1** (R8-09). Off-bike tips only.

### 4.5 Missed workouts (R8-11)

- Missed **Key Workout** → moved to the **next available day this week** if
  Form allows **and** it does not create two hard days in a row. If that day
  already holds a Key Workout, the one with higher block priority stays.
  Otherwise it is **dropped**.
- Missed non-key workout → dropped.
- Every case is explained in the next Daily Brief.

### 4.6 Progression from ride feedback

"Adjust to progress" (round 0) works through ride results:
- Compliance ≥ 90% **and** rating "too easy" twice in a row in the same
  category → the next workout of that category goes **+1 step** (one more
  rep or +2% target) *(our rule)*.
- Rating "too hard", or intervals not completed (compliance < 80%) → **−1 step**.
- FTP changes rescale everything (M12).

## M5. Readiness & Adaptation

**Purpose:** decide every morning whether today's workout fits the body,
and change it automatically if not (D-014).

### 5.1 Morning Check-in (D-015)

Taps only, ~10 seconds:

| Item | Scale |
|---|---|
| Sleep quality | 1–5 |
| Legs | 1–5 |
| Motivation | 1–5 |
| Sick? | yes / no |
| Pain? | yes / no (+ short note → Chat Note) |
| **Gdzie dziś jedziesz?** (Ride Mode) | W domu / Na zewnątrz (pre-filled with the weekday default) |
| (Rest day only) | "Mam dziś czas" → Bonus Day |

If yesterday's ride is not rated yet, the check-in asks for the Ride Rating first (M6.4).

### 5.2 Readiness score *(our rule — calibrated after the Learning Period)*

Each input is rated **ok / caution / bad**:

| Input | Caution | Bad |
|---|---|---|
| HRV (overnight) | tonight below the band (60-day mean − max(1 SD, 3%)) | 7-day average below the band **and** ≥ 3 low nights (D-040) |
| Resting HR | ≥ +5 bpm vs 30-day mean | ≥ +8 bpm |
| Sleep | < 6 h or sleep score < 60 | < 5 h |
| Body Battery (morning max) | < 50 | < 30 |
| Garmin Training Readiness | < 50 | < 25 |
| Form (% of Fitness) | < −30% | < −45% |
| Check-in: legs / sleep quality / motivation | one answer ≤ 2 | legs = 1, or two or more answers ≤ 2 (D-041) |

- **Score** = 100 − 10 × (cautions) − 25 × (bads), limited to 0–100.
- **State:** Green = no bad and ≤ 1 caution · Yellow = 1 bad or ≥ 2
  cautions · Red = ≥ 2 bads.
- **Hard overrides:** Sick → **Red**, rest. Pain → no hard workouts until
  the note ends or the Athlete clears it.
- **Learning Period:** first **14 days** (no HRV/RHR baseline yet): state
  shows "uczę się" (learning); only sleep, Body Battery, Form and the
  check-in count.
- Garmin's Training Readiness is **shown next to** our score (R8-13).
- Missing data (watch not worn) → that input is skipped and the brief says so.

### 5.3 Adaptation rules (engine)

| Readiness | Key Workout | Other workout | Rest day |
|---|---|---|---|
| **Green** | keep | keep | rest (Bonus Day available) |
| **Yellow** | keep structure; −1 rep or −3% targets. 2nd Yellow day in a row → swap with the next easy day if possible | shorten 25%, cap at Z2 | rest |
| **Red** | Recovery ride 30–45 min or rest; Key Workout follows the missed rule (M4.5) | rest or Recovery ≤ 45 min | rest |
| **Sick** | rest | rest | rest |

- **Return after illness:** 1–2 easy days before any intensity *(our rule)*.
- Changes are **applied automatically**, written to intervals.icu, explained
  in the brief, and **undoable with one tap** (D-014). Undo restores the
  previous version and rewrites the calendar.

### 5.4 Safe Envelope for the Coach AI (D-011, R8-12)

The Coach AI (brief or chat) may **propose** only:
- duration change of **±20%**;
- **swap** to a library workout of the **same category**;
- **move** by **±1 day** (to an available day);
- make it **easier** (lower targets, fewer reps, recovery instead).

The engine **rejects** any proposal that: increases intensity above the
plan; raises the week's planned Load; creates **two hard days in a row**;
uses an unavailable day; or ignores a Sick / Pain override. Every proposal
and its verdict is logged.

### 5.5 Daily timing

| When | What |
|---|---|
| 03:00 | Nightly sync, duplicates guard, Load / Fitness / Form, missed-workout rule, calendar writes for the next 7 days (with the **default** Ride Mode per weekday), backup |
| Notification time (per day, D-034) | Web push → Today screen |
| On check-in | Readiness → Adaptation → write the **chosen** variant to the calendar → brief |
| Notification + 2 h, no check-in | Readiness from Garmin data + Form only; default variant stays; brief says "bez check-inu" (R8-16) |
| Every 15 min (05:00–23:00) | Sync new rides → match to plan → ask for the Ride Rating |

### 5.6 Bonus Day (D-027)

On a rest day, "Mam dziś czas" asks for minutes available and offers an
**optional** session that fits Form and **never** reduces the quality of
the next Key Workout (default: Endurance Z2 or Recovery; Tempo only if
Green and the next day is a rest day).

## M6. Daily Brief

**Purpose:** the short, clear morning message (D-016, D-021).

### 6.1 Fixed format

The engine fills every line that holds a number. The Coach AI writes only the
`focus`, `off-bike` and `change-explanation` slots:

```
Dziś: {workout} · {duration} · {W domu / Na zewnątrz}        ← engine
Gotowość: {🟢/🟡/🔴} {state} — {main reason}                   ← engine
Skup się: {one sentence}                                     ← AI slot
Zmiana: {what changed and why} [Cofnij]                      ← engine + AI slot (only if changed)
Jedzenie: {g} g węglowodanów/h, {ml} ml/h                    ← engine (rides > 90 min)
Poza rowerem: {one action}                                   ← AI slot
Jutro: {tomorrow in one line}                                ← engine
```

Example (Monday, Sweet Spot, FTP 270 W):

```
Dziś: Sweet Spot 3×12 min · 60 min · W domu (MyWhoosh)
Gotowość: 🟢 dobra — HRV w normie, nogi świeże
Skup się: równe 245 W w blokach, kadencja 90+, bez przyspieszania na końcu.
Poza rowerem: kolacja z porcją węglowodanów i sen przed 23:00.
Jutro: wolne. Środa: progowe 2×15 min.
```

### 6.2 Rules

- Polish, friendly buddy, **short** (whole brief ≤ ~600 characters).
- **Clear:** no hedging, no disclaimers, no filler (D-021).
- The AI never invents numbers: every number in an AI slot must exist in
  the engine's facts, or the validator rejects it (M11 / 03).
- If the AI fails or the validator rejects twice → the **template text**
  for that slot is used. The brief always arrives.
- Rest day: Readiness + recovery tip + Bonus Day offer + tomorrow.

### 6.3 Off-bike topics

Sleep, fueling, hydration, mobility / stretching, stress. **No diet or
weight-loss advice** (R8-15). No strength sessions (R8-09).

### 6.4 Ride Rating (R8-20)

After a matched ride: **RPE 1–10** + **too easy / just right / too hard**.
Shown on Today after the ride sync; if skipped, it is asked at the next
check-in. It feeds Progression (M4.6).

## M7. Workout Delivery

**Purpose:** today's workout is on the right device without manual steps (D-009, D-020).

| Ride Mode | Variant | Path | Device |
|---|---|---|---|
| W domu (indoor) | Indoor: % FTP steps, ERG | app → intervals.icu → MyWhoosh | KICKR CORE |
| Na zewnątrz (outdoor) | Outdoor: HR zones + RPE (power when a meter exists, D-023) | app → intervals.icu → Wahoo / Garmin | BOLT v2 + Fenix 8 |

- Night: default variant written for the next 7 days (Mon/Wed default
  indoor, Sat/Sun default outdoor; editable per weekday).
- Morning: if the check-in changes the Ride Mode, the app **replaces**
  today's calendar entry with the other variant (S18 checks timing).
- Outdoor rides are **structured with HR ranges**. **Long rides** are
  **guidance rides** (zone cap + duration + fueling reminders), not
  interval-by-interval (R8-17).
- Delivery status is shown on the workout card (written / delivered / failed).
- Fallback: download `.zwo` for MyWhoosh by hand.
- Out of scope v1: Zwift, own trainer control (D-009).

## M8. Progress (R8-18)

Minimal on purpose; deep analysis stays in intervals.icu.
- **Fitness / Fatigue / Form** chart (last 90 days + 4-week plan projection).
- **FTP and W/kg** history (with test markers).
- **Long-ride progress:** longest ride (h, km) vs the target 200 km / 7 h,
  with milestones 4 h → 5 h → 6 h → 7 h.
- **Weekly compliance:** planned vs completed (count + Load).

## M9. Notifications (D-018, D-031, D-034)

- **One web push per day**, every day, at the time set per weekday (default 07:00).
- Training day: "Dzień dobry! 30 s na check-in, potem plan na dziś."
  Rest day: "Dzień wolny. Zrób check-in, sprawdź regenerację."
- Tap → Today screen.
- Works on **iOS and Android** (D-025); iPhone needs the app on the Home
  Screen (shown in onboarding).
- No second push for the ride rating; it waits on Today.

## M10. Coach Chat (D-019)

- Free text in Polish, answers streamed. Context: today's facts, last 14
  days summary, active **Chat Notes**, retrieved Knowledge Base passages.
- **Questions** ("dlaczego dziś sweet spot?") → answered from the Knowledge Base.
- **Change requests** ("mam tylko 45 min") → the AI produces a structured
  proposal → the engine validates it against the Safe Envelope → applied
  with Undo, or refused with the reason.
- **Facts** ("boli mnie kolano", "w przyszłym tygodniu wyjazd") → saved as a
  **Chat Note** with kind (injury / illness / travel / other) and an end
  date (default 7 days). Active notes affect Readiness and planning (pain → no
  hard workouts; travel → no rides on those days). Notes are visible and
  deletable (R8-19).
- Same clarity rules as the brief (D-021).

## M11. Knowledge Base (D-006, D-022)

- **Method Notes:** our own Polish text summarizing the Coggan & Allen
  method: zones, Performance Manager, Load, ramp rates, workout purposes,
  testing, tapering, fueling. Stored in `knowledge/method-notes/` (in git).
- **Book:** added later if found; indexed locally from `private/`, never in git.
- Retrieval: local embeddings + vector search (03). The brief uses the 2–3
  best passages; chat uses up to 5.

## M12. FTP Management (D-036)

- **eFTP**: taken from intervals.icu if available (S05), else 95% of the
  best 20-min power in the last 42 days (indoor or outdoor power).
- **Suggestion** when eFTP differs from current FTP by **≥ 3%** on two
  syncs in a row. The Athlete accepts or rejects. Accept → new Fitness
  Snapshot, future workouts rescaled, calendar rewritten.
- **Ramp test** at the end of each block (Wed of the Recovery Week), indoor
  on the KICKR in ERG: start 100 W, +20 W per minute until failure; **FTP =
  75% of the best 1-minute power**. The result becomes a suggestion as above.
- LTHR / max HR: from Fenix 8 auto-detection or intervals.icu (R8-24); a
  change also creates a Fitness Snapshot.

## M13. Long Rides & Fueling (D-033, R8-08, R8-15)

- **Saturday long ride** grows by **15–30 min per load week**, up to 4 h.
- **Long Ride Day:** every **4–6 weeks** the engine proposes one ride of
  **last long ride + 45–60 min** (5–7 h+), Z2 with an intensity cap. It is
  shown **7 days ahead** and goes into the plan only after the Athlete
  **confirms** it; if declined, the weekend becomes back-to-back (Sat 4 h +
  Sun 2–3 h).
- **Fueling lines** (rides > 90 min) *(our rule, from mainstream sports-
  nutrition guidance)*:
  - carbohydrates **60 g/h**; on rides > 3 h raise gradually toward
    **80–90 g/h** ("gut training": +10 g/h per long ride, only if the
    previous one felt fine);
  - fluids **500–750 ml/h** (more in heat), sodium 300–600 mg/h;
  - pre-ride: carb-rich meal 2–3 h before.
- The brief the day before a long ride includes a short packing line
  (bottles, gels / bars count).

---

## Open questions

None blocking. Remaining unknowns are technical spikes (spikes.md).
