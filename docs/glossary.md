# Glossary

Canonical terms. All docs, code and UI use these exact names. Each entry
has the term, a one-line definition, and a UI label or DB name where they differ.
Terms marked are not confirmed yet.

## People & account

- **Athlete** — the registered user being coached. (DB: `athlete`; UI: "you")
- **Account** — login identity + settings; one Account has one Athlete.

## Goals & planning

- **Goal** — what the Athlete trains for: type + optional target + optional date.
- **Primary Goal / Secondary Goal** — a Goal has one Primary and an optional
  Secondary that shapes part of the week (author: Raise FTP + long rides, D-028).
- **Bonus Day** — an unplanned extra training day the Athlete adds
  ("Mam dziś czas"); the engine offers an optional session that never
  compromises the next Key Workout (D-027).
- **Long Ride Day** — an occasional planned ride longer than the normal
  weekend window (5–7 h), confirmed by the Athlete ahead of time (D-033).
- **eFTP** — estimated FTP computed from recent best efforts; becomes the
  new FTP only after the Athlete accepts it (D-036).
- **Event** — a dated Goal (race, gran fondo, tour). Priority A / B / C.
- **Weekly Availability** — hours per week, available days, max minutes per
  day, indoor/outdoor per day.
- **Training Plan** — the full schedule from today to the Goal date (or a
  rolling horizon).
- **Block** — 4 rolling weeks (3 load + 1 Recovery Week) with one
  **Block Focus** (Sweet Spot, Threshold, VO2max …) (R8-06).
- **Phase** — with an Event: Base, Build, Peak, Taper, periodized to the date. *(proposed set)*
- **Recovery Week** — a planned lower-load week inside a Phase.
- **Planned Workout** — a Workout placed on a specific date in the Training Plan.
- **Workout** — a structured session definition (Steps with duration +
  target). Lives in the **Workout Library**.
- **Step** — one segment of a Workout (warm-up, interval, recovery, cool-down)
  with a target (% FTP, zone, HR, RPE, cadence).
- **Key Workout** — the 1–3 most important Planned Workouts of a week; the
  last things to drop when adapting.

## Data

- **Source** — an external service we import from (Strava, Garmin,
  intervals.icu, FIT upload…). UI label: "Connections".
- **Activity** — a completed ride imported from a Source (or uploaded).
- **Wellness** — daily non-ride data: sleep, HRV, resting HR, Body Battery,
  stress, weight, plus the Morning Check-in.
- **Morning Check-in** — the Athlete's ~10-second subjective daily input
  (sleep quality, legs, motivation, sickness).
- **Compliance** — how well a completed Activity matched its Planned Workout (%).
- **Ride Rating** — RPE 1–10 + too easy / just right / too hard, given after
  a ride (R8-20).
- **Fitness Snapshot** — dated record of FTP, LTHR, max HR and weight; the
  values valid on a ride's date are used for that ride.
- **Delivery Status** — whether a Planned Workout was written to
  intervals.icu for the devices: pending / written / failed.

## Physiology & load

- **FTP** — Functional Threshold Power: the highest power sustainable for
  about an hour, in watts. The basis for power zones.
- **W/kg** — power divided by body weight.
- **LTHR** — lactate threshold heart rate; the basis for HR zones.
- **Resting HR (RHR)** — morning or sleep resting heart rate.
- **HRV** — heart-rate variability (rMSSD, ms), compared to a personal baseline.
- **Power Zones** — Coggan's 7 levels as % of FTP: Z1 Active Recovery,
  Z2 Endurance, Z3 Tempo, Z4 Lactate Threshold, Z5 VO2max, Z6 Anaerobic
  Capacity, Z7 Neuromuscular (D-010). Polish labels: Z1 Regeneracja, Z2
  Wytrzymałość, Z3 Tempo, Z4 Próg, Z5 VO2max, Z6 Beztlenowa, Z7 Sprint.
- **RPE** — rating of perceived exertion, 1–10.
- **Load** — the training stress of one Activity (TSS-equivalent).
- **Fitness** — long-term load average (≈ CTL, 42-day).
- **Fatigue** — short-term load average (≈ ATL, 7-day).
- **Form** — Fitness − Fatigue (≈ TSB).
  > Note: TSS, CTL, ATL, TSB, NP and IF are TrainingPeaks trademarks. We use
  > the generic names above in the UI.
- **Body Battery** — Garmin's proprietary 0–100 energy metric. To us it is
  **only one input** to Readiness, never our own score's name.
- **Readiness** — **our** daily assessment of how ready the Athlete is to
  train: score 0–100 and state **Green / Yellow / Red** (or **Learning**
  during the first 14 days), from Wellness, Load and the Morning Check-in
  (02 M5.2). Not the same as Garmin's Training Readiness, which is one input.
- **Learning Period** — the first 14 days, before HRV and resting-HR
  baselines exist; Readiness uses fewer inputs.

## Coaching

- **Adaptation** — a change the engine makes to the Training Plan, with a reason.
- **Daily Brief** — the short daily coaching message (today's focus +
  off-bike action + tomorrow preview).
- **Plan Engine** — the rule-based component that generates and adapts the
  Training Plan and validates Coach AI proposals (D-011).
- **Coach AI** — the local language model component (Qwen 3.8 at start) that
  writes the Daily Brief, answers questions, and may **propose** Adaptations
  inside the Safe Envelope (D-011).
- **Safe Envelope** — the limits within which the Coach AI may change a
  Planned Workout: ±20% duration, same-category swap, ±1 day, easier only;
  never two hard days in a row (R8-12).
- **Knowledge Base** — the local, searchable index the Coach AI retrieves
  from: Method Notes first, then the Allen & Coggan book if found (the book
  part never leaves the PC). Called "the book" in conversation.
- **Method Notes** — our own written summary of the Coggan method (zones,
  Performance Manager, ramp rates, workout types). It is the first content of
  the Knowledge Base, and it is committed to git (D-022).
- **Coach Chat** — free-text conversation with the Coach AI (D-019).
- **Chat Note** — a fact from the chat (injury, illness, travel, other) with
  an end date; affects Readiness and planning; visible and deletable (R8-19).
- **Template Brief** — the brief built only from fixed templates; used for
  any slot the AI fails to fill and in "no AI" mode.
- **Validator** — checks AI output (format, length, numbers present in the
  facts, Polish, no banned phrases) before it is shown.
- **Notification** — the single daily web push that opens the Today screen (D-018).
- **Performance Manager** — Coggan's model of Fitness / Fatigue / Form over
  time; our Load maths follows it (D-010).

## Riding

- **Indoor** — a ride on the smart trainer (KICKR CORE) in MyWhoosh.
- **Outdoor** — a ride on the road or off-road.
- **ERG mode** — the smart trainer holds the target power regardless of cadence.
- **Ride Mode** — Indoor or Outdoor, chosen by the Athlete each day in the
  Morning Check-in (D-020). UI: "Gdzie dziś jedziesz?" — W domu / Na zewnątrz.
- **Workout Variant** — one of the two versions of a Planned Workout: the
  **Indoor Variant** (power targets, ERG, MyWhoosh) or the **Outdoor Variant**
  (HR/RPE targets now, power once an outdoor power meter exists — D-023;
  shown on the BOLT and/or Fenix 8). Only the chosen one is written to the calendar.
- **Master Copy** — when the same ride arrives twice (e.g. MyWhoosh +
  Fenix), the one copy that counts for Load. Indoors = MyWhoosh (D-024);
  outdoors = BOLT v2, Fenix as fallback (D-029).

## Polish UI labels

| Canonical term | UI label (PL) |
|---|---|
| Today screen | Dziś |
| Week screen | Tydzień |
| Progress screen | Postęp |
| Coach Chat | Czat |
| Settings | Ustawienia |
| Daily Brief | Odprawa |
| Morning Check-in | Poranny check-in |
| Readiness | Gotowość (dobra / uważaj / regeneracja / uczę się) |
| Fitness / Fatigue / Form | Kondycja / Zmęczenie / Forma |
| Load | Obciążenie |
| Key Workout | Trening kluczowy |
| Recovery Week | Tydzień regeneracyjny |
| Ride Mode | Gdzie dziś jedziesz? — W domu / Na zewnątrz |
| Bonus Day | Mam dziś czas |
| Long Ride Day | Dzień długiej jazdy |
| Ride Rating | Jak było? — za łatwo / w sam raz / za ciężko |
| Undo | Cofnij |
| Power Zones | Strefy mocy |
| Chat Note | Pamiętam |
