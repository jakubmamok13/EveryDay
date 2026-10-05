# 06 — UX & Interface

Status: **SPEC v1.1**. Phone-only PWA (D-043), Polish UI, buttons only (D-044), friendly and short (D-016, D-021).

## 1. Principles

1. **Today first.** The app opens on Today; most days nothing else is needed.
2. **Clear, not chatty.** One focus per day; numbers always visible; no
   hedging.
3. **One tap in the morning, never typing.** The check-in is one tap on a
   feeling; every other request is a button (D-044).
4. **Every change is visible and reversible.** "Zmiana" line + **Cofnij** (D-014).
5. **Color never alone.** Readiness and zones always have a text label too.

## 2. Navigation

Bottom tab bar: **Dziś · Tydzień · Trener · Postęp · Ustawienia**.

## 3. Screens

### 3.1 Dziś (Today)

States, top to bottom:

1. Unrated ride from yesterday or today? → **„Jak było?”** card first:
   [Za łatwo] [W sam raz] [Za ciężko].
2. **„Jak się dziś czujesz?”** (until tapped): [W domu | Na zewnątrz], then six
   big buttons in two columns — 💪 W pełni sił · 🙂 Dobrze · 😐 Średnio ·
   😕 Czuję się gorzej · 😫 Totalne wyczerpanie · 🤒 Choroba (the last two in
   red text). „Coś boli?” reveals body-part chips; „Pomiń” skips.
3. **Readiness**: 🟢 / 🟡 / 🔴 + word (dobra / uważaj / regeneracja) +
   score + main reason; Garmin's Training Readiness in small text; link
   „Samopoczucie: … · zmień”.
4. **Odprawa** (Daily Brief), in the fixed format (02 M6.1), with the
   **Zmiana** line + **Cofnij** when the plan was adapted.
4a. **„Dlaczego dziś to?”** (collapsed): plan → signals with values and
   limits → rule → decision + „Co by było, gdyby…” → load (D-048).
5. **Workout card**: name, minutes, Load, step graph colored by zone,
   step list with W (indoor) or ud/min + RPE (outdoor), delivery status
   ("MyWhoosh ✔", "licznik / zegarek ✔").
6. Actions: **Mam mniej czasu** (30–90 min chips) · **Zamień** · **Więcej…**
   (→ Trener) · **.zwo** (indoor).
7. FTP suggestion / Long Ride Day cards when present; **Najbliższe dni**.

Rest day: Readiness + recovery tip + **Mam dziś czas** (Bonus Day) + tomorrow.
Offline: everything works from the phone's data (R8-21); sync waits for
the next open with a connection.

### 3.2 Tydzień (Week)

- 7-day list (swipe for next / previous week): planned vs done, Key
  Workouts marked ★, Recovery Week label, block focus.
- Other sports show with their icon (🏃 🏋️ 🏊 🥾 …) and Load (D-047).
- Tap a planned workout → move (±1–2 days), „Zamień” (same-category list),
  „Pomiń” (R8-07). Tap a skipped future workout → „Przywróć trening”.
  A warning appears if two hard days end up in a row.
- **Long Ride Day proposal** card 7 days ahead: [Potwierdzam] [Nie tym razem].
- **FTP suggestion** card: "Twoje FTP wygląda na 262 W (+12 W)" [Akceptuj] [Odrzuć].

### 3.3 Trener (quick actions, D-044)

Cards of buttons, no text field (02 M10):
- **Dzisiejszy trening:** Mam mniej czasu · Lżej dziś · Dziś odpoczynek · Przesuń na jutro.
- **Coś boli?** body-part chips.
- **Wyjazd:** [Od dziś | Od jutra] × [3 dni] [7 dni] [14 dni] → confirm sheet.
- **Dlaczego ten trening?** purpose + cue + expandable note sections.
- **Pamiętam:** active notes with „Zapomnij”.
- **Baza wiedzy:** list of Method Notes → full note in a sheet.
Every result is shown as a short toast („Zmiana: …”, „Nie mogę: …”).

### 3.4 Postęp (Progress) (R8-18)

1. Fitness / Fatigue / Form chart (90 days + 4-week projection).
2. FTP and W/kg history (test markers).
3. Long-ride progress: longest ride vs the target (e.g. 150 km / 5.5 h), milestones 4 → 5 → 6 → 7 h.
4. Weekly compliance bars (last 12 weeks).

### 3.5 Ustawienia (Settings)

As in 05_settings.md.

### 3.6 Onboarding

9 steps as in 02 M2, a progress dots bar, "Dalej" button, values
pre-filled from intervals.icu, choices as buttons. Step 1 shows the
„Dodaj do ekranu początkowego” hint and „Najpierw wypróbuj demo”. It ends
with **Zaczynamy** (history import + 4 weeks planned).

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
- Reminder text (iPhone Shortcut): „Czas na poranny check-in 🚴”.
- Gender-neutral wording („Jak się spało?”, „Choroba”, „Totalne wyczerpanie”).

## 6. Accessibility

Minimum 44 px tap targets, text contrast WCAG AA, labels with every color,
system font size respected.

## Open questions

- **Q-UX-01** (optional) Any app whose look you like? Without an answer, the
  design follows the principles above.
