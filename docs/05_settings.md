# 05 — Settings

Status: **SPEC v1.1** (phone only, D-043; no AI, D-044). UI labels in
Polish (D-013); the English name is given for the docs. "Fixed" = not
editable, on purpose. Defaults below are the **sample athlete** used by demo
mode (D-046); real values are entered in onboarding.

## Profil (Profile)

| Setting | Default (sample) | Notes |
|---|---|---|
| Waga / wzrost | 75 kg / 178 cm | Weight change → new Fitness Snapshot |
| FTP | 250 W | History list in Postęp; change → snapshot + rescale future workouts (M12) |
| LTHR / tętno max | from the watch / intervals.icu | R8-24 |
| Miernik mocy na zewnątrz | No | Yes → Outdoor Variant uses power (D-023) |
| Sprzęt | chosen in onboarding (trainer, bike computer, watch, HR strap, power meter) | Roles: indoor recorder, outdoor master (D-024, D-029) |

## Cele (Goals)

| Setting | Default | Notes |
|---|---|---|
| Cel główny | Raise FTP | D-028 |
| Cel dodatkowy | Long rides (target km / h) | D-033 |
| Wydarzenie | none | Adding one switches to date-based periodization (R8-06) |

Saving goals regenerates the plan from today; history is kept.

## Dostępność (Availability)

Per weekday: available · max minutes · default Ride Mode.

| Day | Available | Max | Default mode |
|---|---|---|---|
| Pon (Mon) | — | — | — |
| Wt (Tue) | ✔ | 60 | W domu |
| Śr (Wed) | — | — | — |
| Czw (Thu) | ✔ | 60 | W domu |
| Pt (Fri) | — | — | — |
| Sob (Sat) | ✔ | 180 | Na zewnątrz |
| Nd (Sun) | ✔ | 120 | Na zewnątrz |

Plus: **Dni długiej jazdy** (Long Ride Days) on/off, every 4–6 weeks (R8-08).

## Poranne przypomnienie (Morning reminder, D-045)

- Time buttons: 06:00 · 06:30 · 07:00 · 07:30 · 08:00 · 09:00 (default 07:00).
- Step-by-step guide for the **iPhone Shortcuts** automation (Android: a
  clock alarm), with the chosen time filled in.

## intervals.icu

- Status, last sync, „Synchronizuj teraz”.
- „Zmień klucz API” (API key + optional athlete ID). The key stays on this
  phone only.
- The app also syncs on every open (catch-up).

## Dane i kopia zapasowa (Data & backup)

- „Eksportuj kopię” → JSON file via the share sheet (Files / iCloud); no API key inside.
- „Wczytaj kopię” → replace this phone's data with a file.
- „Ułóż plan od nowa”.
- „Usuń wszystkie dane…” (two-step confirmation).

## Tryb demo

- In demo: banner with „Wyjdź z demo” and „Zacznij demo od nowa”.
- Outside demo: „Wypróbuj demo (osobne dane)” in System.

## System

- Theme: follows the phone (R8-23); manual override light / dark.
- Status: last daily job, last sync, number of rides / wellness days,
  Method Notes count, time zone.
- Language: Polish (**fixed**).

## What is deliberately not configurable (Q-SET-01)

Tone, brief format and safety rules (Safe Envelope, no two hard days in a
row, sick / exhausted rule) are fixed. They are the product's promise
(clear, safe, short), so they are not settings.
