# 05 — Settings

Status: **SPEC v1**. UI labels in Polish (D-013); the English name is given
for the docs. "Fixed" = shown but not editable, on purpose.

## Profil (Profile)

| Setting | Default (author) | Notes |
|---|---|---|
| Waga / wzrost | 86 kg / 174 cm | Weight change → new Fitness Snapshot |
| FTP | 270 W | History list; change → snapshot + rescale future workouts (M12) |
| LTHR / tętno max | from Fenix 8 / intervals.icu | R8-24 |
| Miernik mocy na zewnątrz | No | Yes → Outdoor Variant uses power (D-023) |
| Sprzęt | KICKR CORE · BOLT v2 · Fenix 8 · HR strap | Roles: indoor recorder, outdoor master (D-024, D-029) |

## Cele (Goals)

| Setting | Default | Notes |
|---|---|---|
| Cel główny | Raise FTP | D-028 |
| Cel dodatkowy | Long rides: 200 km / 7 h | D-033 |
| Wydarzenie | none | Adding one switches to date-based periodization (R8-06) |
| "Zacznij nowy plan" | — | Regenerates from today; history kept |

## Dostępność (Availability)

Per weekday: available · max minutes · default Ride Mode · notification time.

| Day | Available | Max | Default mode | Notify |
|---|---|---|---|---|
| Pon (Mon) | ✔ | 60 | W domu | 07:00 |
| Wt (Tue) | — | — | — | 07:00 |
| Śr (Wed) | ✔ | 60 | W domu | 07:00 |
| Czw (Thu) | — | — | — | 07:00 |
| Pt (Fri) | — | — | — | 07:00 |
| Sob (Sat) | ✔ | 240 | Na zewnątrz | 07:00 |
| Nd (Sun) | ✔ | 240 | Na zewnątrz | 07:00 |

Plus: **Dni długiej jazdy** (Long Ride Days) on/off, every 4–6 weeks (R8-08).

## Powiadomienia (Notifications)

- Time per day (above), on/off (D-034).
- Registered devices (phone, PC) with "send test notification" and remove.
- iPhone help: "Dodaj do ekranu początkowego" guide (D-025).

## Trener (Coach)

| Setting | Value | Notes |
|---|---|---|
| Ton | Kumpel (friendly buddy) | **Fixed** (D-016) |
| Format odprawy | Fixed template | **Fixed** (D-021) |
| Model AI | Qwen 3.8 27B uncensored | Fallback: official Qwen 3.8 (D-026) |
| Tryb bez AI | Off | On = template brief only, chat disabled |
| Pamięć czatu | List of Chat Notes | View, edit end date, delete (R8-19) |
| Zasady bezpieczeństwa | Safe Envelope, no 2 hard days in a row, sick rule | **Fixed**, shown read-only (R8-12) |

## Połączenia (Connections)

- intervals.icu: athlete ID, API key (stored encrypted), "Test", last sync,
  "Synchronizuj teraz".
- Manual **FIT upload** (R8-14).
- Status of the devices delivered through intervals.icu: MyWhoosh / Wahoo / Garmin.

## Dane i prywatność (Data & privacy)

- Export all data (ZIP) (R8-03).
- Backup location: default `data/backups/`; optional second folder.
- Active sessions (devices) → revoke.
- Delete account (typed confirmation).

## Wygląd (Appearance)

- Theme: follows the phone (R8-23); manual override light / dark.
- Language: Polish (**fixed** in v1).

## System (advanced, collapsed)

- Status page: last night job, last sync, AI status, push status, disk space.
- Learning Period end date (Readiness).
- Job log (no health data).

## What is deliberately not configurable (Q-SET-01)

Tone, brief format and safety rules are fixed. They are the product's
promise (clear, safe, short), so they are not settings.
