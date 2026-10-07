# 04 — Data Model

Status: **SPEC v1.2** (schema v4). One SQLite database (sql.js, WebAssembly) kept in the
phone's IndexedDB (D-043, 03). No FIT files are stored (the ride summary
from intervals.icu is enough). All dates are local dates in the phone's
time zone; timestamps are UTC.

Tables from the PC version that are **no longer used** but kept in the
schema (harmless, empty): `device_session`, `push_subscription`,
`ai_proposal`, `chat_message`, `knowledge_chunk`, `notification_log`.

Conventions: `id` = integer primary key; `*_json` = JSON text; every table
has `created_at` / `updated_at` (omitted below). Canonical names follow glossary.md.

## 1. Entity map

```
account 1─1 athlete
athlete 1─N fitness_snapshot · equipment · goal · availability(→ availability_day)
athlete 1─N source_connection · activity · wellness_day · check_in · daily_state
athlete 1─N training_plan 1─N block 1─N plan_week 1─N planned_workout N─1 workout
planned_workout 1─N adaptation · 0..1 activity (master)
athlete 1─N daily_brief · chat_note · ftp_suggestion · long_ride_proposal
job_run · setting · meta (system tables)
```

## 2. Account & profile

**account** — one local row created on first open (`email` = 'local',
empty `password_hash`; no login, D-043). Owns the settings.

**athlete** — `account_id`, `display_name`, `height_cm`,
`outdoor_power_meter` (bool, D-023), `learning_until` (date, end of the
Learning Period), `sex` ('m' | 'f' — only to pick the power profile table, D-054).

**fitness_snapshot** (versioned physiology) — `athlete_id`,
`effective_from` (date), `ftp_w`, `lthr_bpm`, `max_hr_bpm`, `weight_kg`,
`source` ('onboarding' | 'ramp_test' | '20min_test' | 'eftp_accepted' |
'watch' | 'manual'), `note`. The value for any date = the latest snapshot
with `effective_from ≤ date`.

**equipment** — `athlete_id`, `kind` ('trainer' | 'bike_computer' | 'watch' |
'hr_strap' | 'power_meter'), `model` (generic label, e.g. 'Trenażer',
'Licznik rowerowy', 'Zegarek'), `role` ('indoor_recorder' | 'outdoor_master' |
'outdoor_fallback' | null), `active`.

## 3. Goals & availability

**goal** — `athlete_id`, `role` ('primary' | 'secondary'), `type`
('raise_ftp' | 'endurance' | 'event' | 'general_fitness'), `target_json`
(e.g. `{"targetDistanceKm":150,"targetMinutes":330}`), `event_name`, `event_date`,
`priority` ('A' | 'B' | 'C'), `status` ('active' | 'archived'), `archived_at`.
Changing a goal archives the old row and creates a new one (D-028).

**availability** (versioned) — `athlete_id`, `effective_from`,
`long_ride_days_allowed` (bool), `long_ride_every_weeks` (4–6).

**availability_day** — `availability_id`, `weekday` (1 = Mon … 7 = Sun),
`available` (bool), `max_minutes`, `default_ride_mode` ('indoor' |
'outdoor'), `notify_time` (kept; the reminder time is now a setting, D-045).

Example (sample athlete): Tue 60 indoor · Thu 60 indoor · Sat 180 outdoor ·
Sun 120 outdoor · other days unavailable.

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
'bolt' | 'fenix' | 'upload'), `type` ('Ride' | 'VirtualRide', or the
intervals.icu type for other sports), `sport` ('ride' | 'run' | 'whole_body' |
'walk' | 'swim' | 'strength' | 'mobility' | 'other', D-047), `start_at`,
`moving_seconds`, `distance_m`, `elevation_m`, `avg_power_w`,
`weighted_power_w`, `avg_hr`, `max_hr`, `load`, `load_basis` ('power' | 'hr' |
'icu' | 'default'),
`is_master` (bool), `duplicate_of` (activity id), `planned_workout_id`,
`compliance_pct`, `rpe` (1–10), `feel` ('too_easy' | 'just_right' |
'too_hard'), `effort` ('easy' | 'moderate' | 'hard' | 'very_hard' |
'all_out', D-053), `completed` ('yes' | 'partial' | 'no'), `fit_path`,
`best_1min_w`, `best_20min_w`, `peaks_json` (best 5 s / 1 / 5 / 20 min W and,
for rides ≥ 2 h, the bests after 20 kJ/kg — from the power stream, D-063),
`streams_done` (bool: stream already analysed).

**wellness_day** — `athlete_id`, `date`, `hrv_ms`, `resting_hr`,
`sleep_seconds`, `sleep_score`, `body_battery_max`, `body_battery_min`,
`garmin_readiness`, `stress_avg`, `weight_kg`, `fetched_at`. Raw fields
also kept in `raw_json`, in case the field names differ (S05).

**check_in** — `athlete_id`, `date`, `sleep_quality` (1–5), `legs` (1–5),
`motivation` (1–5), `sick` (bool), `pain` (bool), `pain_note`, `ride_mode`,
`bonus_minutes` (rest-day Bonus Day), `submitted_at`, `exhausted` (bool,
D-044), `feeling` (the button tapped: 'great' | 'good' | 'ok' | 'worse' |
'exhausted' | 'sick'). The 1–5 values come from the feeling (02 M5.1).

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
('engine' | 'manual' | 'bonus'), `action` ('keep' | 'shorten' |
'reduce' | 'swap' | 'move' | 'recovery' | 'rest' | 'bonus' | 'drop' |
'ride_mode'), `before_json`, `after_json`, `reason_codes_json`, `applied_at`,
`undone_at`, `undo_of`.

**daily_brief** — `athlete_id`, `date`, `facts_json`, `text_pl`,
`slots_source_json` ('{}' — templates only), `with_check_in` (bool),
`generated_at`, `opened_at`. (`model`, `prompt_version`,
`validator_passed`, `pushed_at` are legacy columns.)

**chat_note** — `athlete_id`, `kind` ('injury' | 'illness' | 'travel' |
'other'), `text`, `start_date`, `end_date`, `deleted_at`. Created by the
„Coś boli” / „Wyjazd” buttons, the pain part of the check-in and onboarding
(the table name is historical).

**ftp_suggestion** — `athlete_id`, `current_ftp_w`, `suggested_ftp_w`,
`basis` ('eftp' | 'ramp_test' | '20min_test'), `evidence_json`, `status`
('pending' | 'accepted' | 'rejected'), `decided_at`.

**long_ride_proposal** — `athlete_id`, `proposed_date`, `minutes`,
`status` ('proposed' | 'confirmed' | 'declined' | 'done' | 'expired' |
'withdrawn' — an event's taper or recovery now covers the day, D-058),
`planned_workout_id`.

**week_override** (D-057) — `athlete_id`, `week_start` (Monday),
`days_json` (7 × `{weekday, available, maxMinutes}`); primary key
(`athlete_id`, `week_start`). Only that week uses it.

**season_event** (D-058) — `athlete_id`, `date`, `name`, `priority`
('A' | 'B' | 'C'), `hot` (bool, heat acclimation D-062), `deleted_at`.

## 8. System tables

**job_run** — `job` ('night' = the daily catch-up job), `started_at`,
`finished_at`, `status`, `error_code` (no health data).

**meta** — `key`, `value`: schema version, `last_night_job` (date),
`last_day_sync` (ms timestamp), `ladder_hist:{athlete}` (Monday snapshots of
the ladder, 12 weeks, D-064), `return:{athlete}` and `return_done:{athlete}`
(the current return after a break, D-060).

**setting** — `account_id`, `key`, `value_json` (05_settings.md).

## 9. Retention, backup, export

- Keep **all ride and wellness rows** (R8-22); a year of data is a few MB.
- **Persistence:** the whole database is exported (`db.export()`) to
  IndexedDB 300 ms after each change and at once when the app is hidden.
- **Export** (R8-03): one JSON file `{ app: "everyday", version: 1, tables: {…}, meta: {…} }`
  with every user table and the athlete's `meta` keys (not the device-only
  `last_*` and `backup_*`, D-067); the intervals.icu key is blanked.
- **Copy on Google Drive** (D-067): the same file, wrapped as
  `{ app: "everyday-backup", savedAt, device, data }`, through the author's
  Apps Script. Device-local `meta`: `backup_url`, `backup_device`,
  `backup_hash`, `backup_saved_at`, `backup_seen`, `backup_error`,
  `backup_conflict`.
- **Import** replaces all data with the file (the current key and
  intervals.icu connection are kept).
- **Delete everything** wipes all user tables on this phone after a
  confirmation. Data in intervals.icu is not touched.
- **Migrations:** v1 = the original schema; v2 adds `check_in.exhausted`
  and `check_in.feeling` (D-044); v3 adds `activity.sport` (D-047); v4 adds
  `activity.effort`, `completed`, `peaks_json`, `streams_done`,
  `athlete.sex`, and the tables `week_override` and `season_event`
  (D-053 … D-063). Export includes the new tables.
