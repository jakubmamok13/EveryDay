# 04 — Data Model

Status: **SPEC v1**. One SQLite file `data/everyday.db` (03). FIT files on
disk in `data/fit/YYYY/MM/`. All dates are local dates (Europe/Warsaw);
timestamps are UTC.

Conventions: `id` = integer primary key; `*_json` = JSON text; every table
has `created_at` / `updated_at` (omitted below). Canonical names follow glossary.md.

## 1. Entity map

```
account 1─1 athlete
athlete 1─N fitness_snapshot · equipment · goal · availability(→ availability_day)
athlete 1─N source_connection · activity · wellness_day · check_in · daily_state
athlete 1─N training_plan 1─N block 1─N plan_week 1─N planned_workout N─1 workout
planned_workout 1─N adaptation (1─0..1 ai_proposal) · 0..1 activity (master)
athlete 1─N daily_brief · chat_message · chat_note · ftp_suggestion · long_ride_proposal
account 1─N device_session · push_subscription
knowledge_chunk · job_run (system tables)
```

## 2. Account & profile

**account** — `email`, `password_hash`, `locale` ('pl'), `timezone` ('Europe/Warsaw').

**device_session** — `account_id`, `device_name`, `token_hash`,
`remember` (bool), `last_seen_at`, `revoked_at`.

**push_subscription** — `account_id`, `endpoint`, `p256dh`, `auth`,
`platform` ('ios' | 'android' | 'desktop'), `last_success_at`, `failure_count`.

**athlete** — `account_id`, `display_name`, `height_cm`,
`outdoor_power_meter` (bool, D-023), `learning_until` (date, end of the
Learning Period).

**fitness_snapshot** (versioned physiology) — `athlete_id`,
`effective_from` (date), `ftp_w`, `lthr_bpm`, `max_hr_bpm`, `weight_kg`,
`source` ('onboarding' | 'ramp_test' | '20min_test' | 'eftp_accepted' |
'fenix' | 'manual'), `note`. The value for any date = the latest snapshot
with `effective_from ≤ date`.

**equipment** — `athlete_id`, `kind` ('trainer' | 'bike_computer' | 'watch' |
'hr_strap' | 'power_meter'), `model` (e.g. 'Wahoo KICKR CORE', 'ELEMNT BOLT v2',
'Fenix 8'), `role` ('indoor_recorder' | 'outdoor_master' |
'outdoor_fallback' | null), `active`.

## 3. Goals & availability

**goal** — `athlete_id`, `role` ('primary' | 'secondary'), `type`
('raise_ftp' | 'endurance' | 'event' | 'general_fitness'), `target_json`
(e.g. `{"distance_km":200,"duration_min":420}`), `event_name`, `event_date`,
`priority` ('A' | 'B' | 'C'), `status` ('active' | 'archived'), `archived_at`.
Changing a goal archives the old row and creates a new one (D-028).

**availability** (versioned) — `athlete_id`, `effective_from`,
`long_ride_days_allowed` (bool), `long_ride_every_weeks` (4–6).

**availability_day** — `availability_id`, `weekday` (1 = Mon … 7 = Sun),
`available` (bool), `max_minutes`, `default_ride_mode` ('indoor' |
'outdoor'), `notify_time` ('07:00').

Author's current rows: Mon 60 indoor · Wed 60 indoor · Sat 240 outdoor ·
Sun 240 outdoor · other days unavailable · all notify 07:00.

## 4. Plan

**training_plan** — `athlete_id`, `reason` ('onboarding' | 'goal_change' |
'availability_change' | 'manual_regen'), `status` ('active' | 'superseded'),
`starts_on`, `goal_ids_json`.

**block** — `plan_id`, `index`, `start_date`, `end_date`, `focus`
('sweet_spot' | 'threshold' | 'vo2max' | 'base' | 'build' | 'peak' | 'taper').

**plan_week** — `block_id`, `week_start` (Monday), `kind` ('load' |
'recovery'), `target_load`, `target_minutes`.

**workout** (Workout Library, loaded from `library/workouts/`) — `slug`,
`name_pl`, `category`, `purpose_pl`, `focus_cue_pl`, `intensity_class`
('easy' | 'moderate' | 'hard'), `is_test`, `indoor_steps_json`,
`outdoor_steps_json`, `scaling_json`, `base_minutes`, `library_version`.

**planned_workout** — `athlete_id`, `plan_week_id`, `date`, `workout_slug`,
`is_key` (bool), `origin` ('engine' | 'ai' | 'manual' | 'chat' | 'bonus' |
'long_ride_day'), `minutes`, `planned_load`, `steps_indoor_json` and
`steps_outdoor_json` (scaled targets in W / bpm), `ride_mode` ('indoor' |
'outdoor'), `ride_mode_source` ('default' | 'check_in' | 'manual'),
`status` ('planned' | 'completed' | 'partial' | 'skipped' | 'missed' |
'moved' | 'replaced'), `icu_event_id`, `delivery_status` ('pending' |
'written' | 'failed'), `delivered_at`, `version`.

## 5. Data in

**source_connection** — `athlete_id`, `provider` ('intervals_icu'),
`external_athlete_id`, `api_key_encrypted`, `status` ('ok' | 'auth_error' |
'unreachable'), `last_sync_at`, `last_error`.

**activity** — `athlete_id`, `icu_activity_id`, `source_device` ('mywhoosh' |
'bolt' | 'fenix' | 'upload'), `type` ('Ride' | 'VirtualRide'), `start_at`,
`moving_seconds`, `distance_m`, `elevation_m`, `avg_power_w`,
`weighted_power_w`, `avg_hr`, `max_hr`, `load`, `load_basis` ('power' | 'hr'),
`is_master` (bool), `duplicate_of` (activity id), `planned_workout_id`,
`compliance_pct`, `rpe` (1–10), `feel` ('too_easy' | 'just_right' |
'too_hard'), `fit_path`, `best_1min_w`, `best_20min_w`.

**wellness_day** — `athlete_id`, `date`, `hrv_ms`, `resting_hr`,
`sleep_seconds`, `sleep_score`, `body_battery_max`, `body_battery_min`,
`garmin_readiness`, `stress_avg`, `weight_kg`, `fetched_at`. Raw fields
also kept in `raw_json`, in case the field names differ (S05).

**check_in** — `athlete_id`, `date`, `sleep_quality` (1–5), `legs` (1–5),
`motivation` (1–5), `sick` (bool), `pain` (bool), `pain_note`, `ride_mode`,
`bonus_minutes` (rest-day Bonus Day), `submitted_at`.

## 6. Derived per day

**daily_state** — `athlete_id`, `date`, `load` (sum of master activities),
`fitness`, `fatigue`, `form`, `form_pct`, `readiness_score` (0–100),
`readiness_state` ('green' | 'yellow' | 'red' | 'learning'),
`readiness_inputs_json` (each input: value, baseline, ok / caution / bad /
missing), `computed_at`. Recomputed when any input for that date changes.

### Formulas (D-010, Coggan Performance Manager)

- **Load (power):** `seconds × WP × (WP/FTP) / (FTP × 3600) × 100`, where WP =
  weighted (normalized) power. FTP = the snapshot valid on the ride date.
- **Load (HR, outdoor without power):** HR-based equivalent from time in
  LTHR-based HR zones. If intervals.icu provides a per-activity load, that
  value is used and `load_basis` records its basis **[S05]**.
- **Fitness** = 42-day exponentially weighted average of daily Load;
  **Fatigue** = 7-day; **Form** = Fitness − Fatigue (using yesterday's
  values for today's morning decision); `form_pct` = Form / Fitness.
- Only **master** activities count (duplicates have `load` ignored).
- **HRV band:** 60-day mean ± 1 SD of the 7-day rolling average *(our rule)*.
- **Resting HR baseline:** 30-day mean.

## 7. Coaching records

**adaptation** — `athlete_id`, `date`, `planned_workout_id`, `origin`
('engine' | 'ai' | 'manual' | 'chat'), `action` ('keep' | 'shorten' |
'reduce' | 'swap' | 'move' | 'recovery' | 'rest' | 'bonus' | 'drop' |
'ride_mode'), `before_json`, `after_json`, `reason_codes_json`, `applied_at`,
`undone_at`, `undo_of`.

**ai_proposal** — `adaptation_id` (null if rejected), `context`
('brief' | 'chat'), `raw_json`, `verdict` ('accepted' | 'rejected'),
`rejection_reasons_json`, `model`.

**daily_brief** — `athlete_id`, `date`, `facts_json`, `text_pl`,
`slots_source_json` (per slot: 'ai' | 'template'), `model`,
`prompt_version`, `validator_passed`, `with_check_in` (bool),
`generated_at`, `pushed_at`, `opened_at`.

**chat_message** — `athlete_id`, `role` ('user' | 'coach'), `content`,
`adaptation_id`, `note_id`.

**chat_note** — `athlete_id`, `kind` ('injury' | 'illness' | 'travel' |
'other'), `text`, `start_date`, `end_date`, `source_message_id`, `deleted_at`.

**ftp_suggestion** — `athlete_id`, `current_ftp_w`, `suggested_ftp_w`,
`basis` ('eftp' | 'ramp_test' | '20min_test'), `evidence_json`, `status`
('pending' | 'accepted' | 'rejected'), `decided_at`.

**long_ride_proposal** — `athlete_id`, `proposed_date`, `minutes`,
`status` ('proposed' | 'confirmed' | 'declined' | 'done' | 'expired'),
`planned_workout_id`.

## 8. System tables

**knowledge_chunk** — `source` ('method_notes' | 'book'), `doc_path`,
`heading`, `text`, `embedding` (vector), `content_hash`. Book chunks live
only in the local DB (never exported to git).

**job_run** — `job` ('night' | 'day_sync' | 'push' | 'calendar_write' |
'brief' | 'backup'), `started_at`, `finished_at`, `status`, `error_code`,
`details_json` (no health data).

**setting** — `account_id`, `key`, `value_json` (05_settings.md).

## 9. Retention, backup, export

- Keep **everything forever**, including FIT files (R8-22). The expected
  size is small (tens of MB per year + FIT files).
- Nightly SQLite backup: 14 daily + 8 weekly copies (03 §8).
- **Export** (R8-03): ZIP with one JSON file per table + all FIT files +
  Method Notes version. **Delete account** removes DB rows and files after a
  typed confirmation; backups older than the deletion are removed too.
