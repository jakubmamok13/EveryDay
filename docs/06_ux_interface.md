# 06 — UX & Interface

Status: **SPEC v1**. Mobile-first PWA (R8-23), Polish UI, friendly and short (D-016, D-021).

## 1. Principles

1. **Today first.** The notification opens Today; most days nothing else is needed.
2. **Clear, not chatty.** One focus per day; numbers always visible; no
   hedging.
3. **Big tap targets in the morning.** The check-in is done half-awake: 5
   taps, no typing.
4. **Every change is visible and reversible.** "Zmiana" line + **Cofnij** (D-014).
5. **Color never alone.** Readiness and zones always have a text label too.

## 2. Navigation

Phone: bottom tab bar: **Dziś · Tydzień · Czat · Postęp · Ustawienia**.
PC: same items in a left sidebar; Today and Week side by side if wide.

## 3. Screens

### 3.1 Dziś (Today)

States, top to bottom:

1. **Check-in card** (until submitted): sleep quality, legs, motivation
   (1–5 faces), sick / pain toggles, **Gdzie dziś jedziesz?** [W domu |
   Na zewnątrz]. Unrated ride from yesterday? → **Ride Rating** first.
2. **Readiness**: 🟢 / 🟡 / 🔴 + word (dobra / uważaj / regeneracja) +
   score + main reason; Garmin's Training Readiness in small text next to it.
3. **Odprawa** (Daily Brief), in the fixed format (02 M6.1).
4. **Workout card**: name, minutes, Load, step graph colored by zone,
   step list with W (indoor) or ud/min + RPE (outdoor), delivery status
   ("MyWhoosh ✔", "BOLT ✔", "Fenix ✔").
5. **Change line** (if adapted): what changed and why + **Cofnij**.
6. Actions: **Mam tylko … min** · **Pomiń** · **Zamień** · **Czat**.
7. After the ride is synced: **Ride Rating** card (RPE 1–10 +
   za łatwo / w sam raz / za ciężko) and compliance %.

Rest day: Readiness + recovery tip + **Mam dziś czas** (Bonus Day) + tomorrow.
Offline: the last loaded Today stays viewable (R8-21) with an
"offline — dane z HH:MM" label.

### 3.2 Tydzień (Week)

- 7-day list (swipe for next / previous week): planned vs done, Key
  Workouts marked ★, Recovery Week label, block focus.
- Drag or "Przenieś" to move; "Pomiń", "Zamień" (same-category list) (R8-07).
  A warning appears if two hard days end up in a row.
- **Long Ride Day proposal** card 7 days ahead: [Potwierdzam] [Nie tym razem].
- **FTP suggestion** card: "Twoje FTP wygląda na 281 W (+11 W)" [Akceptuj] [Odrzuć].

### 3.3 Czat (Coach Chat)

- Chat bubbles; the coach streams its answer.
- Quick chips: "Mam tylko 45 min", "Bolą mnie nogi", "Dlaczego ten trening?".
- When the coach changes the plan: an inline card with the change + Cofnij.
- "Pamiętam:" line listing active Chat Notes (tap → edit / delete).

### 3.4 Postęp (Progress) (R8-18)

1. Fitness / Fatigue / Form chart (90 days + 4-week projection).
2. FTP and W/kg history (test markers).
3. Long-ride progress: longest ride vs 200 km / 7 h, milestones 4 → 5 → 6 → 7 h.
4. Weekly compliance bars (last 12 weeks).

### 3.5 Ustawienia (Settings)

As in 05_settings.md.

### 3.6 Onboarding

≤ 10 screens as in 02 M2, one question per screen, a progress dots bar,
"Dalej" button, values pre-filled from intervals.icu. It ends with a
plan preview (next 4 weeks) → **Zaczynamy**.

## 4. Visual language

- Calm, high-contrast, generous spacing; one accent color.
- **Zone colors** (with labels): one validated blue ramp, light → dark for
  Z1, Z2, Z3, Z4, Z5+ (dark mode: dark → light). The zone number is always
  written next to the color (D-042).
- Readiness: green / amber / red + text.
- Light and dark themes follow the phone (R8-23).
- Numbers in tabular figures; watts always with "W", heart rate with "ud/min" (Polish for bpm).

## 5. Copy rules (Polish)

- Friendly buddy, short sentences, "Ty" form.
- One focus per brief. No "może", "warto rozważyć", "skonsultuj się".
- Numbers only from the engine.
- Notification texts: training day "Dzień dobry! 30 s na check-in, potem
  plan na dziś." · rest day "Dzień wolny. Zrób check-in, sprawdź regenerację."

## 6. Accessibility

Minimum 44 px tap targets, text contrast WCAG AA, labels with every color,
system font size respected.

## Open questions

- **Q-UX-01** (optional) Any app whose look you like? Without an answer, the
  design follows the principles above.
