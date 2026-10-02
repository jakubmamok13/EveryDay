# 07 — Integrations

Status: **SPEC v1** — intervals.icu hub (D-004); field names to confirm in spike S05

The user wants automatic import from Strava, Garmin, MyWhoosh, Zwift, etc.
Research on 2026-10-01 found that **most of these are closed or restricted
for a new, small, free app**. This shapes the whole product, so it comes first.

## 1. Landscape (as of 2026-10-01; details and sources in spikes.md)

| Source | Public API for a new app? | What we could get | Main blockers |
|---|---|---|---|
| **Strava** | Yes, restricted | Activities + streams (power, HR, cadence, GPS) | Since Jun 2026 a developer must pay a Strava subscription (~$11.99/mo). New app: 1 athlete → 10 without review; >10 needs Strava approval. API terms forbid using Strava data "in AI models or similar". Data may be shown only to the athlete themselves. (S01) |
| **Garmin Connect** | Partner program only | Activities, FIT files, **Body Battery**, sleep, HRV, stress, RHR; can push workouts to devices (Training API) | Companies only (no individuals). Program reported **paused for new applications** in 2026. Health data is deleted from Garmin's API after 7 days, so we must store it immediately. (S02) |
| **Zwift** | No (partners only, no hobby developers) | — | Zwift auto-uploads to Garmin Connect / Strava / intervals.icu etc., so we get the data indirectly. (S03) |
| **MyWhoosh** | No public API | — | **Direct intervals.icu integration (2026):** planned workouts for the next 7 days go into MyWhoosh; completed rides go to intervals.icu. Also accepts `.zwo` via workout.mywhoosh.com. (S04, S13) |
| **intervals.icu** ✅ chosen | Yes, open (personal API key / OAuth) | Activities, wellness from Garmin (HRV, RHR, sleep stages, **Body Battery** via custom fields `BodyBatteryMin/Max`, **Garmin Training Readiness**), calendar; can push workouts to Garmin/Zwift/Wahoo via its own sync | Third-party dependency. Strava-sourced activities come out of its API as **empty stubs**, so sources must be linked to intervals.icu directly. (S05) |
| **Polar, Wahoo, COROS, Suunto, Whoop, Oura** | Varies | Activities / recovery | Eligibility unverified. (S10) |
| **Apple Health / Google Health Connect** | Native apps only | — | Not reachable from a web app. (S11) |
| **Manual FIT upload** | Always works | Full ride data | Not automatic. Garmin Connect / Zwift / MyWhoosh all export FIT. |

## 2. Candidate strategies — **A chosen (D-004)**, D kept as fallback

- **A. intervals.icu as the hub. ✅ CHOSEN (D-004)**
  The user connects Garmin / Zwift / MyWhoosh / Wahoo to intervals.icu (free).
  We read activities and wellness from intervals.icu with one integration.
  Bonus: we can write planned workouts to the intervals.icu calendar, and it
  pushes them to Garmin, Zwift and Wahoo.
  Risks: depends on a third party (free service run by a small team); the
  Garmin wellness scopes must be granted. Body Battery: available (research, S05).
- **B. Strava direct.** Good for activities only, with no wellness data and
  no Body Battery. Capped at 10 users without approval, costs a monthly fee,
  and the AI clause is a legal risk given "AI reads the data".
- **C. Garmin direct.** Best data, including Body Battery, but blocked now
  (company only + paused). Revisit later.
- **D. Manual FIT upload + Morning Check-in.** Zero dependency; works for
  everyone; not automatic. Good fallback in any case.
- **E. Combination**, e.g. A + D for v1, C when Garmin reopens.

## 3. File formats

- **In:** FIT (primary), TCX, GPX (no power usually).
- **Out (workouts):** intervals.icu workout (written via the API, primary);
  `.zwo` download as a manual fallback for MyWhoosh (accepted via
  workout.mywhoosh.com).

## 4. Data path for v1 (D-004, D-009)

```
 IN (completed rides + wellness)
 Garmin watch / Edge ─► Garmin Connect ─┐  (rides, Body Battery, HRV, sleep, RHR,
                                        │   Training Readiness)
 MyWhoosh (indoor) ─────────────────────┼──► intervals.icu ──API (read)──► EveryDay
                                        │
 Wahoo ELEMNT BOLT v2 ─► Wahoo cloud ───┤  (outdoor rides — Master Copy, D-029)
                                        │
 OUT (planned workouts)                 │
 EveryDay ──API (write calendar)──► intervals.icu ─┬─► Garmin Connect ─► Fenix 8 (outdoor, HR)
                                                   ├─► Wahoo ─► ELEMNT BOLT v2 (outdoor, HR)  [S21]
                                                   └─► MyWhoosh ─► KICKR CORE (indoor, ERG power)
```

Zwift is out of scope (D-009).

**Duplicate rule (S19, D-024):** each ride must count **once**. Indoors both
MyWhoosh and the Fenix record, so filter Garmin "VirtualRide" in
intervals.icu and keep the MyWhoosh copy (it has power). Outdoors both the
BOLT v2 and the Fenix record: the **BOLT copy is master**, with Fenix as
fallback (D-029). The app has its own duplicate guard as a safety net.

**Indoor vs outdoor variant (D-020):** the variant chosen in the Morning
Check-in is the one written to the calendar for that day.

Rule: never rely on the **Strava → intervals.icu** path; those activities are
stubs in the API.

## 5. intervals.icu API usage (expected — confirm in S05 / S14)

Authentication: personal API key (HTTP Basic, user `API_KEY`), athlete ID
from the intervals.icu settings.

| Need | Expected endpoint | Notes |
|---|---|---|
| Rides | `GET /api/v1/athlete/{id}/activities?oldest=&newest=` | Includes source/device, load, power, HR fields |
| Ride file | activity FIT download endpoint | Stored in `data/fit/` (R8-22) |
| Wellness | `GET /api/v1/athlete/{id}/wellness?oldest=&newest=` | HRV, resting HR, sleep, custom `BodyBatteryMin/Max`, readiness |
| Write workout | `POST /api/v1/athlete/{id}/events` (category WORKOUT) | Returns event id → `planned_workout.icu_event_id` |
| Replace workout | `PUT` / `DELETE` on that event | Ride Mode switch, adaptations, undo |
| eFTP | athlete / activity fields | Used for FTP suggestions (M12) |

Polling only (15 min by day, nightly full sync); webhooks optional later.
The exact paths and field names are written here after spike S05.

## Open questions

- ~~Q-INT-01~~ → D-004.
- ~~Q-INT-02~~ Fenix 8 + HR strap; Wahoo KICKR CORE + MyWhoosh indoors (01 §4).
- ~~Q-INT-03~~ → R8-13: our own Readiness; Garmin's shown next to it and used as one input.
- ~~Q-INT-04~~ → Two-way, via the intervals.icu calendar (D-009).
- ~~Q-INT-05~~ Moot for a personal tool (D-002).
- ~~Q-INT-06~~ → R8-14: yes, manual FIT upload as fallback.
- ~~Q-INT-07~~ No account yet → Phase 0 setup (D-032).
- ~~Q-INT-08~~ → D-023 (HR now, power meter later).
- ~~Q-INT-09~~ → D-024 (both record indoors → keep MyWhoosh copy).
- ~~Q-INT-10~~ → D-029: both record and show; BOLT v2 = Master Copy.
