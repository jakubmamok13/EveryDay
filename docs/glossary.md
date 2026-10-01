# Glossary

Canonical terms. All docs, code and UI use these exact names. Each entry
has the term, a one-line definition, and a UI label or DB name where they differ.
Terms marked *(proposed)* are not confirmed yet.

## People & account

- **Athlete** — the registered user being coached. (DB: `athlete`; UI: "you")
- **Account** — login identity + settings; one Account has one Athlete.

## Goals & planning

- **Goal** — what the Athlete trains for: type + optional target + optional date.
- **Event** — a dated Goal (race, gran fondo, tour). Priority A / B / C. *(proposed)*
- **Weekly Availability** — hours per week, available days, max minutes per
  day, indoor/outdoor per day.
- **Training Plan** — the full schedule from today to the Goal date (or a
  rolling horizon).
- **Phase** — a block of weeks with one purpose: Base, Build, Specialty
  (Peak), Taper, Transition. *(proposed set)*
- **Recovery Week** — a planned lower-load week inside a Phase.
- **Planned Workout** — a Workout placed on a specific date in the Training Plan.
- **Workout** — a structured session definition (Steps with duration +
  target). Lives in the **Workout Library**.
- **Step** — one segment of a Workout (warm-up, interval, recovery, cool-down)
  with a target (% FTP, zone, HR, RPE, cadence).
- **Key Workout** — the 1–3 most important Planned Workouts of a week; the
  last things to drop when adapting. *(proposed)*

## Data

- **Source** — an external service we import from (Strava, Garmin,
  intervals.icu, FIT upload…). UI label: "Connections". *(proposed)*
- **Activity** — a completed ride imported from a Source (or uploaded).
- **Wellness** — daily non-ride data: sleep, HRV, resting HR, Body Battery,
  stress, weight, plus the Morning Check-in.
- **Morning Check-in** — the Athlete's ~10-second subjective daily input
  (sleep quality, legs, motivation, sickness). *(proposed)*
- **Compliance** — how well a completed Activity matched its Planned Workout.

## Physiology & load

- **FTP** — Functional Threshold Power: the highest power sustainable for
  about an hour, in watts. The basis for power zones.
- **W/kg** — power divided by body weight.
- **LTHR** — lactate threshold heart rate; the basis for HR zones.
- **Resting HR (RHR)** — morning or sleep resting heart rate.
- **HRV** — heart-rate variability (rMSSD, ms), compared to a personal baseline.
- **Power Zones** — Coggan's 7 levels as % of FTP: Z1 Active Recovery,
  Z2 Endurance, Z3 Tempo, Z4 Lactate Threshold, Z5 VO2max, Z6 Anaerobic
  Capacity, Z7 Neuromuscular (D-010). Polish UI labels TBD.
- **RPE** — rating of perceived exertion, 1–10.
- **Load** — the training stress of one Activity (TSS-equivalent).
- **Fitness** — long-term load average (≈ CTL, 42-day).
- **Fatigue** — short-term load average (≈ ATL, 7-day).
- **Form** — Fitness − Fatigue (≈ TSB).
  > Note: TSS, CTL, ATL, TSB, NP and IF are TrainingPeaks trademarks. We use
  > the generic names above in the UI. *(proposed)*
- **Body Battery** — Garmin's proprietary 0–100 energy metric. To us it is
  **only one input** to Readiness, never our own score's name.
- **Readiness** — **our** daily assessment of how ready the Athlete is to train
  (scale TBD), from Wellness + Load.

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
  Planned Workout. The Plan Engine rejects anything outside. *(limits TBD: Q-ADP-04)*
- **Knowledge Base** — the local, searchable index of the training book
  (Allen & Coggan) that the Coach AI retrieves from. Never leaves the PC.
  (Called "the book" in conversation.)
- **Performance Manager** — Coggan's model of Fitness / Fatigue / Form over
  time; our Load maths follows it (D-010).

## Riding

- **Indoor** — a ride on a smart trainer / rollers, usually in Zwift,
  MyWhoosh or another app.
- **Outdoor** — a ride on the road or off-road.
- **ERG mode** — the smart trainer holds the target power regardless of cadence.
