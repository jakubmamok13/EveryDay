# 05 — Settings

Status: **SPEC v1.2** (phone only, D-043; no AI, D-044; season and research features D-049 … D-065). UI labels in
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
| Tabela profilu mocy | Mężczyzna | Mężczyzna / Kobieta — only picks Coggan's table for the power profile (D-054) |
| Sprzęt | chosen in onboarding (trainer, bike computer, watch, HR strap, power meter) | Roles: indoor recorder, outdoor master (D-024, D-029) |

## Cele (Goals)

| Setting | Default | Notes |
|---|---|---|
| Cel główny | Raise FTP | D-028 |
| Cel dodatkowy | Long rides (target km / h) | D-033 |
| Wydarzenie | none | Adding one switches to date-based periodization (R8-06) |

Saving goals regenerates the plan from today; history is kept.

## Sezon (Season events, D-058)

- List of events: date, name (optional), priority **A / B / C**, „w upale”
  (heat acclimation card from 14 to 2 days before, D-062). Delete button.
- Adding or deleting an event rebuilds the plan from today (taper and
  recovery around it). A Long Ride Day inside an event window is withdrawn.

## Tydzień inny niż zwykle (one-week override, D-057)

Not in Ustawienia: in **Tydzień › „Ten tydzień jest inny…”** — days and
minutes for that week only; „Przywróć zwykły tydzień” removes it.

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

## Inne sporty (Other sports, D-047, D-069)

- „Licz bieg, siłownię i inne sporty” — default **on**. Off = only rides count;
  turning it on or off recalculates Fitness, Fatigue and Form at once.

## Poranne przypomnienie (Morning reminder, D-045)

- Time buttons: 06:00 · 06:30 · 07:00 · 07:30 · 08:00 · 09:00 (default 07:00).
- Step-by-step guide for the **iPhone Shortcuts** automation (Android: a
  clock alarm), with the chosen time filled in.

## intervals.icu

- Status, last sync, „Synchronizuj teraz”.
- „Zmień klucz API” (API key + optional athlete ID). The key stays on this
  phone only.
- The app also syncs on every open (catch-up).

## Kopia na Dysku Google (Drive copy, D-068)

- No client ID: why, link to [DYSK-GOOGLE.md](DYSK-GOOGLE.md), the redirect
  URI and JavaScript origin to copy, client ID field (a built-in ID from the
  `GOOGLE_CLIENT_ID` variable is used when present).
- Not signed in: [Połącz z Dyskiem Google] (redirect to Google), hint for
  „invalid_client”.
- Signed in, no folder: the app's folders [Użyj tego folderu], or a name +
  [Utwórz folder].
- Connected: folder + account, last copy / error, the copies in the folder
  (device, time, [Wczytaj…] for other devices), this phone's name,
  [Zapisz kopię teraz] or [Zaloguj do Dysku Google], „Odłącz” (copies stay).
- Saving is automatic (20 s after a change, on every open).

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
