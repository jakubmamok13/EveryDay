# 04 — Data Model

Status: **SKELETON** — entity list only; fields come after modules are agreed.

## Entities (proposed, canonical names from glossary.md)

- Account 1—1 Athlete
- Athlete 1—N SourceConnection (provider, tokens, last sync, status)
- Athlete 1—N Goal (type, target, date, priority)
- Athlete 1—1 WeeklyAvailability (versioned: changes are kept as history)
- Athlete 1—N TrainingPlan (one active) 1—N Phase 1—N PlannedWorkout
- WorkoutLibrary 1—N Workout 1—N Step
- PlannedWorkout N—1 Workout (scaled copy for this Athlete/day)
- Athlete 1—N Activity (+ streams: power, HR, cadence, speed, GPS) — optional link to PlannedWorkout
- Athlete 1—N WellnessDay (date, sleep, HRV, RHR, Body Battery, stress, weight, source)
- Athlete 1—N MorningCheckIn
- Athlete 1—N FitnessSnapshot (FTP, LTHR, max HR, weight over time)
- Derived per day: Load, Fitness, Fatigue, Form, Readiness
- Athlete 1—N Adaptation (date, what changed, reason codes)
- Athlete 1—N DailyBrief (date, text, inputs used, model version)

## Open questions

- **Q-DAT-01** Keep raw streams (second-by-second) forever, or only summaries
  after N days? (storage cost vs re-analysis)
- **Q-DAT-02** Data retention after a Source is disconnected (Strava terms
  may require deletion).
