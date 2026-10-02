# 08 — Errors, Logging & Feedback

Status: **SPEC v1.1** (phone only, D-043; no AI, D-044). Guiding rule:
**the morning brief always arrives**, even if sync or the calendar fails. It
then says what is missing.

## 1. Failure handling

| Failure | Detection | What the app does | What the Athlete sees |
|---|---|---|---|
| No internet / intervals.icu unreachable | fetch error / timeout | Work from local data; retry on the next open | Today works; "Problem z intervals.icu: brak połączenia" line |
| intervals.icu API key invalid | 401 / 403 | `status = auth_error`, stop syncing | Line on Today → Ustawienia › intervals.icu |
| Calendar write failed | API error | `delivery_status = failed`, retried on every open | Workout card "nie wysłano ✖" + **.zwo** button |
| Device did not get the workout | Delivery check unavailable (S14/S18) | — | Card shows the intervals.icu status only; manual check |
| Watch not worn (no wellness) | Missing fields | Readiness skips those inputs | "brak danych z zegarka" in the Readiness reason |
| Duplicate rides | Duplicates guard (M3) | Non-master gets no Load | "+ duplikat z zegarka (nie liczy się)" in Week |
| Button change outside the Safe Envelope | Engine validation | Refused | Toast "Nie mogę: …" with the reason |
| App not opened for days | Catch-up on the next open | Daily job runs once: sync 14 days, missed-workout rule, plan maintenance | Plan up to date after a few seconds |
| Storage write failed | IndexedDB error | Logged to the console; retried on the next change | — (rare; export regularly) |
| iPhone: data "missing" after installing | Safari vs Home Screen storage are separate | — | Onboarding hint: install first, then open from the icon |
| Wasm / start-up failure | Exception on start | — | "Nie udało się uruchomić aplikacji" + „Spróbuj ponownie” |

## 2. Training safety rails (engine, not configurable)

- Planned Fitness ramp ≤ +5 per week.
- Never two hard days in a row (also for manual moves: warning).
- Sick or Totalne wyczerpanie → rest; after illness 1–2 easy days before intensity.
- Pain note active → no hard workouts.
- Long Ride Day only after explicit confirmation; step ≤ +60 min over the
  previous longest ride.
- Recovery Week every 4th week.
- Buttons cannot raise intensity or weekly Load (Safe Envelope).

## 3. Logging

- No log files and no telemetry: there is no server.
- `job_run` table records the daily job (status, error code; no health data).
- Errors go to the browser console only.

## 4. Status (Settings › System)

Last daily job · last sync · rides / wellness days stored · Method Notes ·
time zone · intervals.icu status (in the intervals.icu card).

## 5. Feedback loops (how the coach improves)

| Signal | Source | Used for |
|---|---|---|
| Ride Rating (three buttons) | Athlete (R8-20) | Progression ±1 step (M4.6) |
| Compliance % | Ride vs plan | Progression; missed-workout rule |
| **Undo** of an adaptation | Athlete | If engine changes are often undone, rules get tuned |
| Refused button actions | Engine | Shows which requests the envelope blocks |
| Readiness vs ride outcome | Data | After the Learning Period: check whether Yellow/Red days really had worse rides → calibrate thresholds |

The exported JSON contains these tables, so a review can be done with the
export file when the app is maintained.
