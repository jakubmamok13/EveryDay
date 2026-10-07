# 02 — Feature Modules

Status: **SPEC v1.2** — interview decisions D-001 … D-069 applied (phone only, no AI, buttons only since D-043/D-044; research features D-049 … D-065).
Rules marked *(our rule)* are not taken from the book; they are our own
choices and are tuned after the first weeks of real use.

Modules:
M1 Account & Profile · M2 Onboarding · M3 Data Sync · M4 Plan Engine ·
M5 Readiness & Adaptation · M6 Daily Brief · M7 Workout Delivery ·
M8 Progress · M9 Reminder · M10 Trener (quick actions) · M11 Knowledge Base ·
M12 FTP Management · M13 Long Rides & Fueling

---

## M1. Profile & Data

**Purpose:** one athlete per phone; the data model stays multi-athlete-ready (D-002).

- **No login** (D-043): the data lives only on this phone (IndexedDB). The
  first open runs Onboarding (M2). The Goal can be changed later in Settings (D-028).
- **Profile:** weight, height, FTP, LTHR, max HR, outdoor power meter
  yes/no, equipment list. Physiology values are **versioned**: every change
  creates a Fitness Snapshot with a date and a source (test, eFTP accepted,
  manual). Old rides keep the values that were valid on their date.
- **Data:** export everything (one JSON file, without the API key), import it
  on this or another phone, and delete everything, in Settings (R8-03).
- **Copy on Google Drive (D-068):** Google sign-in (redirect, scope
  `drive.file`), one file per device in an app folder; saved automatically
  after changes and on open; a new phone starts from it; a newer copy from
  another device is offered on Today, never overwritten silently.
- **Demo mode:** simulated data in a separate store; enter and leave from
  onboarding or Settings.

## M2. Onboarding

**Purpose:** a plan in ~3 minutes, with **≤ 10 screens**, pre-filled from
intervals.icu (R8-04).

| # | Screen | Pre-filled from |
|---|---|---|
| 1 | Start: connect intervals.icu (API key + optional athlete ID) — or „Najpierw wypróbuj demo” | — |
| 2 | Profile: weight, height, FTP, LTHR, max HR | intervals.icu |
| 3 | Goals: Primary (Raise FTP / Endurance / Event / General fitness), Secondary + target, Event date | — |
| 4 | Weekly Availability: per weekday available?, max minutes, default Ride Mode | — |
| 5 | Long Ride Days: yes/no, every 4/5/6 weeks | — |
| 6 | Equipment: tap to select (smart trainer, bike computer, watch, HR strap, power meter) | — |
| 7 | Health: „Wszystko OK” / „Po chorobie” / „Boli: …” buttons → Chat Note for 7 days | — |
| 8 | Reminder: time + iPhone Shortcut guide (M9) | default 07:00 |
| 9 | Ready → „Zaczynamy” | — |

Result: history import + 4 weeks planned → Today.

On iPhone the onboarding shows „Dodaj do ekranu początkowego” first: Safari
and the Home Screen app keep **separate data** (D-043).

- **No fitness test in week 1**: the entered FTP is used. The first test is at
  the end of block 1 (R8-05).
- History import: Fitness and Fatigue start from the imported history, so
  the first plan is scaled to real current Load.

## M3. Data Sync

**Purpose:** get rides and wellness from intervals.icu and send planned
workouts back (D-004, D-009). Details: 07_integrations.md.

- **In:** activities (MyWhoosh indoor, bike computer + watch outdoor, and all
  other sports, D-047), wellness
  (HRV, resting HR, sleep, Body Battery min/max, Garmin Training Readiness,
  weight). The phone calls the intervals.icu API directly (D-043).
- **Out:** the chosen Workout Variant for each Planned Workout, written to
  the intervals.icu calendar. intervals.icu then pushes it to MyWhoosh,
  Garmin and Wahoo.
- **Other sports (D-047, D-069):** runs, strength, swims etc. are stored with a
  sport group. They never match the plan; they add Load **sport-weighted, the
  same in Fitness and Fatigue** (run 0.6, ski/row 0.5, walk 0.3, swim 0.2,
  strength/yoga 0), so a steady routine settles at Form 0. Their short-term
  leg fatigue is a Readiness signal (M5.2). Load = intervals.icu Load, else a per-sport
  hourly default (strength ≥ 45/h). Setting: Ustawienia › Inne sporty.
- **Master Copy rule** (D-024, D-029): every ride counts once.
  Indoors = MyWhoosh copy. Outdoors = bike computer copy, with the watch copy
  as fallback. Duplicate guard: same day + overlapping time + duration within
  15% → the non-master copy is marked `duplicate_of` and gets no Load.
- **When:** on every app open / return to the screen (catch-up, M5.5). No
  background sync on the phone.
- FIT upload: done in intervals.icu itself (R8-14 changed by D-043).

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

### 4.2 Weekly template (D-027, D-028, D-033)

Roles are assigned from the Weekly Availability. Example for a sample week
(Tue/Thu 1 h, Sat 3 h, Sun 2 h):

| Day | Max | Role | Content |
|---|---|---|---|
| Tue | 1 h | **Key Workout 1** | Quality session of the Block Focus (usually indoor, ERG) |
| Thu | 1 h | **Key Workout 2** | Quality session of the Block Focus |
| Sat | ≤ 3 h | **Key Workout 3: long ride** | Z2 with Tempo / Sweet Spot segments in later weeks; grows toward the long-ride target |
| Sun | ≤ 2 h | Back-to-back endurance | Z2; Tempo only if Form allows |
| Other days | — | Rest | Bonus Day possible (M5.6) |

- Recovery Week: first quality day easy spin, **second quality day = ramp test** (M12), weekend Z2 shorter.
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

### 4.6 Progression from ride feedback (D-053)

"Adjust to progress" (round 0) works through ride results *(our rule)*:
- Each rating scores: Łatwo +1, Umiarkowanie +0.5, Ciężko 0, Bardzo ciężko
  −0.5, Na maksa −1; „Częściowo” −0.5 more; „Nie” (not completed) −1.
- The last two rated rides of a category sum ≥ 1.5 **and** compliance ≥ 90%
  → the next workout of that category goes **+1 step**.
- Last ride ≤ −1, the last two ≤ −1, or compliance < 80% → **−1 step**.
- Levels are visible in Postęp; Today's workout shows „łatwy dla Ciebie /
  osiągalny / ambitny / bardzo ambitny” (D-052).
- FTP changes rescale everything (M12).

### 4.7 „Ten tydzień jest inny…” (D-057)

One week can get its own days and minutes (Tydzień screen). Only that week
is rebuilt; the normal availability stays. Roles (long day, quality days)
come from each week's own availability.

### 4.8 Season events A / B / C (D-058)

Events with priority change the plan around them: A = 2-week taper (volume
×0.75, then ×0.5, intensity kept), openers the day before, 5 easy days after;
B = 4 lighter days, 2 easy after; C = easy or openers the day before, 1 easy
after; no workout on the event day. The primary Event goal is an A event.

### 4.9 Return after a break (D-060)

≥ 7 days without a ride → ladder −1 / −2 / −3 (7–13 / 14–27 / ≥ 28 days),
first week at 70 / 60 / 50% volume with 2–3 easy days, FTP suggestion
×0.97 / ×0.94 from 14 / 28 days. Once per break; not during a trip or illness.

### 4.10 Interval block (D-061, optional)

Raise-FTP goal only: week 1 has VO2max on every available day ≥ 45 min
(not the long day, no ramp cap); the next 3 weeks have one VO2max session.
Started in Trener or from the stagnation card (D-064).

### 4.11 Weakness focus (D-054)

Raise-FTP goal only: when the power profile shows VO2max (5 min) or
threshold as the weakest aerobic point, the second quality workout of load
weeks uses that category.

## M5. Readiness & Adaptation

**Purpose:** decide every morning whether today's workout fits the body,
and change it automatically if not (D-014).

### 5.1 Morning Check-in (D-015, D-044)

**One tap**, ~3 seconds. Choose where you ride (pre-filled with the weekday
default), optionally „Coś boli?” → body part, then tap a feeling — that tap
submits:

| Button | Means (sleep / legs / motivation) | Effect |
|---|---|---|
| 💪 W pełni sił | 5 / 5 / 5 | normal |
| 🙂 Dobrze | 4 / 4 / 4 | normal |
| 😐 Średnio | 3 / 3 / 3 | normal |
| 😕 Czuję się gorzej | 3 / 2 / 2 | strong signal → usually Yellow |
| 😫 Totalne wyczerpanie | 2 / 1 / 1 + exhausted | **Red, rest** (override) |
| 🤒 Choroba | sick | **Red, rest** (override) |
| Coś boli? → Kolano / Plecy / Biodro / Kark / Łydka / Achilles / Inne | — | Pain override + injury note for 7 days |

„Pomiń” builds the brief from watch data only (R8-16). After the check-in,
„zmień” re-opens it. On a rest day the card is the same; „Mam dziś czas”
offers a Bonus Day. An unrated ride from yesterday or today shows first (M6.4).

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
| Check-in (from the feeling button) | one answer ≤ 2 | legs = 1, or two or more answers ≤ 2 (D-041) |
| Other sports — run / strength (D-047) | Load ≥ 40 yesterday or ≥ 80 two days ago | Load ≥ 100 yesterday |

- **Score** = 100 − 10 × (cautions) − 25 × (bads), limited to 0–100.
- **State:** Green = no bad and ≤ 1 caution · Yellow = 1 bad or ≥ 2
  cautions · Red = ≥ 2 bads.
- **Hard overrides:** Sick or Totalne wyczerpanie → **Red**, rest (score ≤ 20).
  Pain → no hard workouts until the note ends or the Athlete clears it.
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

### 5.4 Safe Envelope (D-011, R8-12)

There is no AI any more (D-044); the same envelope checks every button
action. A change may only be:
- duration change of **±20%**;
- **swap** to a library workout of the **same category**;
- **move** by **±1 day** (to an available day);
- make it **easier** (lower targets, fewer reps, recovery instead).

The engine **rejects** any proposal that: increases intensity above the
plan; raises the week's planned Load; creates **two hard days in a row**;
uses an unavailable day; or ignores a Sick / Pain override. The Athlete's own
requests („Mam mniej czasu”, „Dziś odpoczynek”) may shorten by more than 20% (D-041).

### 5.5 Daily timing (catch-up, D-043)

There is no server, so jobs run when the app is opened or comes back to the
screen:

| When | What |
|---|---|
| First open of the day | Sync last 14 days, duplicates guard, Load / Fitness / Form, missed-workout rule, block advance, long-ride proposal, keep 4 weeks planned, calendar writes for the next 7 days (default Ride Mode per weekday), FTP check |
| Later opens (≥ 15 min apart) | Sync last 3 days → match rides to the plan → ask for the Ride Rating; re-send pending calendar writes |
| Reminder time (M9) | iPhone Shortcut notification → the Athlete opens EveryDay |
| On check-in | Readiness → Adaptation → write the **chosen** variant to the calendar → brief |
| „Pomiń” (no check-in) | Readiness from watch data + Form only; brief says "bez check-inu" (R8-16) |

intervals.icu delivers the calendar to MyWhoosh / Wahoo / Garmin on its own,
so devices are up to date even when the app is closed.

### 5.6 Bonus Day (D-027) and Green light (D-050)

On a rest day, "Mam dziś czas" asks for minutes available and offers an
**optional** session that fits Form and **never** reduces the quality of
the next Key Workout (default: Endurance Z2 or Recovery; Tempo only if
Green and the next day is a rest day).

**Green light (proactive):** when readiness is green, the feeling is good,
Form ≥ −10% and the week has room under the ramp cap, Today offers up to 3
extra rides on its own. Each option shows Form on the next key day before →
after. Key workout tomorrow → Z1/Z2 up to 75 min only; projected Form on
the next key day must stay ≥ −25%; ≤ 2 extra rides a week and ≥ 1 free day
left. While the offer is shown, the plain „Mam dziś czas” card is hidden.

### 5.7 Warning for tomorrow (D-051)

Tomorrow key or hard and projected morning Form < −30% → yellow card;
< −45% → red. Buttons: „Lżej jutro”, „Przesuń na …”, „Zostaw plan”.

## M6. Daily Brief

**Purpose:** the short, clear morning message (D-016, D-021).

### 6.1 Fixed format

The engine fills every line from fixed Polish templates (no AI, D-044):

```
Dziś: {workout} · {duration} · {W domu / Na zewnątrz}        ← engine
Gotowość: {🟢/🟡/🔴} {state} — {main reason}                   ← engine
Skup się: {one sentence}                                     ← template per workout
Zmiana: {what changed and why} [Cofnij]                      ← engine (only if changed)
Jedzenie: {g} g węglowodanów/h, {ml} ml/h                    ← engine (rides > 90 min)
Poza rowerem: {one action}                                   ← template
Jutro: {tomorrow in one line}                                ← engine
```

Example (Tuesday, Sweet Spot, FTP 250 W):

```
Dziś: Sweet Spot 3×12 min · 60 min · W domu (MyWhoosh)
Gotowość: 🟢 dobra — HRV w normie, dobre samopoczucie
Skup się: równe 225 W w blokach, kadencja 90+, bez przyspieszania na końcu.
Poza rowerem: kolacja z porcją węglowodanów i sen przed 23:00.
Jutro: wolne. Czwartek: progowe 2×15 min.
```

### 6.1a „Dlaczego dziś to?” (D-048)

A collapsible card under the brief: 1 Plan (block, week, role, limit,
purpose or rest-day reason) · 2 every signal with value, limits and rating ·
3 colour rule + score formula · 4 decision + „Co by było, gdyby…” · 5 Fitness /
Fatigue / Form and other sports of the last 7 days.

### 6.2 Rules

- Polish, friendly buddy, **short** (whole brief ≤ ~600 characters).
- **Clear:** no hedging, no disclaimers, no filler (D-021).
- Every number comes from the engine's facts (templates only, D-044).
- Rest day: Readiness + recovery tip + Bonus Day offer + tomorrow.

### 6.3 Off-bike topics

Sleep, fueling, hydration, mobility / stretching, stress. **No diet or
weight-loss advice** (R8-15). No strength sessions (R8-09).

- **Carbohydrate of the day (D-062):** mało 3–5, średnio 5–7, dużo 6–10,
  bardzo dużo 8–12 g/kg by today's ride; tomorrow's long or hard ride
  raises it one step (ACSM 2016).
- **Heat acclimation (D-062):** for a „w upale” event, from 14 to 2 days
  before: easy 45–60 min rides in the heat, a count of training days, optional
  hot bath after an easy ride.
- **Weekly summary (D-064):** Monday–Wednesday, last week in 4 lines;
  stagnation (6 weeks without progress) offers the interval block.

### 6.4 Ride Rating (R8-20, D-053)

After a matched ride: „Ukończone interwały: Całość / Częściowo / Nie” and
five buttons **Łatwo / Umiarkowanie / Ciężko / Bardzo ciężko / Na maksa**
(RPE stored 3 / 5 / 7 / 8 / 10). Shown on Today after the ride sync (rides
from yesterday or today). It feeds Progression (M4.6).

## M7. Workout Delivery

**Purpose:** today's workout is on the right device without manual steps (D-009, D-020).

| Ride Mode | Variant | Path | Device |
|---|---|---|---|
| W domu (indoor) | Indoor: % FTP steps, ERG | app → intervals.icu → MyWhoosh | smart trainer |
| Na zewnątrz (outdoor) | Outdoor: HR zones + RPE (power when a meter exists, D-023) | app → intervals.icu → Wahoo / Garmin | bike computer + watch |

- First open of the day: default variant written for the next 7 days
  (default Ride Mode per weekday, editable in Availability).
- Morning: if the check-in changes the Ride Mode, the app **replaces**
  today's calendar entry with the other variant (S18 checks timing).
- Outdoor rides are **structured with HR ranges**. **Long rides** are
  **guidance rides** (zone cap + duration + fueling reminders), not
  interval-by-interval (R8-17).
- Delivery status is shown on the workout card (written / delivered / failed).
- Fallback: save a `.zwo` file for MyWhoosh (share sheet on the phone).
- Out of scope v1: Zwift, own trainer control (D-009).

## M8. Progress (R8-18)

Minimal on purpose; deep analysis stays in intervals.icu.
- **Fitness / Fatigue / Form** chart (last 90 days + 4-week plan projection).
- **FTP and W/kg** history (with test markers).
- **Long-ride progress:** longest ride (h, km) vs the long-ride target
  (e.g. 200 km / 7 h), with milestones 4 h → 5 h → 6 h → 7 h.
- **Weekly compliance:** planned vs completed (count + Load).
- **FTP confidence (D-056):** eFTP estimate, number of hard efforts in 42
  days, test advice only when confidence is low.
- **Form forecast (D-059):** Fitness and Form (% of Fitness) on each event
  and Long Ride Day in the next 8 weeks vs the target range.
- **Progression levels (D-052)** per category.
- **Power profile (D-054):** 5 s / 1 / 5 / 20 min W/kg on Coggan's table,
  rider type, weakest point (from power streams, D-063).
- **Durability (D-055):** % of fresh 5 / 20-min power kept after 20 kJ/kg.

## M9. Reminder (D-031, D-045)

- No web push (no server). One **iPhone Shortcuts automation** per day:
  Automatyzacja → Pora dnia (chosen time, default 07:00) → Uruchom
  natychmiast → Pokaż powiadomienie „Czas na poranny check-in 🚴”.
- The Athlete then taps the **EveryDay** icon (a Shortcut cannot open a Home
  Screen web app directly). Android: a clock alarm.
- The step-by-step guide is in onboarding and in Settings › Poranne przypomnienie.

## M10. Trener — quick actions (D-044, replaces Coach Chat)

All buttons, no typing. Every change passes the Safe Envelope (5.4), is
written to intervals.icu and can be undone („Cofnij” on Today, „Przywróć”
for a skipped day in Tydzień).

| Button | Effect |
|---|---|
| Mam mniej czasu → 30 / 45 / 60 / 75 / 90 min | Today's workout shortened (structure kept where possible) |
| Lżej dziś | Key Workout: −1 rep / −3%; other: −25% and capped at Z2; with pain: easy Z2 ≤ 60 min |
| Dziś odpoczynek | Today skipped |
| Przesuń na jutro | Today's workout moved by one day (envelope checks two hard days) |
| Coś boli → body part | Injury note for 7 days (no hard workouts) + today easier |
| Wyjazd → od dziś / od jutra × 3 / 7 / 14 dni | Travel note + planned rides in that window skipped |
| Dlaczego ten trening? | Purpose + focus cue + the 2 best matching Method Note sections |
| Baza wiedzy | Read the Method Notes |
| Pamiętam | Active notes with an end date; „Zapomnij” deletes (R8-19) |

## M11. Knowledge Base (D-006, D-022)

- **Method Notes:** our own Polish text summarizing the Coggan & Allen
  method: zones, Performance Manager, Load, ramp rates, workout purposes,
  testing, tapering, fueling. Stored in `knowledge/method-notes/` (in git).
- Bundled with the app at build time; readable offline in Trener › Baza wiedzy.
- Retrieval for „Dlaczego ten trening?”: keyword search (TF-IDF-like, crude
  Polish stemming) over note sections; no embeddings (D-044).
- **Book:** not used (copyrighted text stays out of the repo and the app).

## M12. FTP Management (D-036)

- **eFTP**: taken from intervals.icu if available (S05), else 95% of the
  best 20-min power in the last 42 days (indoor or outdoor power).
- **Suggestion** when eFTP differs from current FTP by **≥ 3%** on two
  syncs in a row. The Athlete accepts or rejects. Accept → new Fitness
  Snapshot, future workouts rescaled, calendar rewritten. Reject → the same
  value is not suggested again for 28 days unless eFTP moves ≥ 3% from it (D-066).
- **Ramp test** at the end of each block (second quality day of the Recovery
  Week), indoor on the smart trainer in ERG: start 100 W, +20 W per minute until failure; **FTP =
  75% of the best 1-minute power**. The result becomes a suggestion as above.
- LTHR / max HR: from the watch's auto-detection or intervals.icu (R8-24); a
  change also creates a Fitness Snapshot.

## M13. Long Rides & Fueling (D-033, R8-08, R8-15)

- **Weekend long ride** grows by **15–30 min per load week**, up to the day's max.
- **Long Ride Day:** every **4–6 weeks** the engine proposes one ride of
  **last long ride + 45–60 min** (5–7 h+), Z2 with an intensity cap. It is
  shown **7 days ahead** and goes into the plan only after the Athlete
  **confirms** it; if declined, the weekend becomes back-to-back (long Sat +
  shorter Sun). Never in an event's taper, on its day or in the recovery
  after it; an event added later withdraws it (D-058). A declined date is
  never proposed again (D-066).
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
