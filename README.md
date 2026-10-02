# EveryDay — your cycling coach on the phone

EveryDay is a free cycling coach that runs **entirely on your phone**. There
is no server, no PC and no AI, and it costs nothing. Every morning you tap
how you feel. The coach adjusts today's workout to your body and sends it to
**MyWhoosh** (indoors) or to your **bike computer and watch** (outdoors)
through intervals.icu.

**Open the app:** https://jakubmamok13.github.io/EveryDay/

- **Plan:** 4-week blocks to raise FTP, plus a build-up to long rides (Allen & Coggan method).
- **Readiness:** HRV, resting heart rate, sleep, Body Battery, Garmin readiness, training load, and your one-tap check-in.
- **No typing:** buttons such as „W pełni sił”, „Czuję się gorzej”,
  „Totalne wyczerpanie”, „Choroba”, „Mam mniej czasu”, „Coś boli”, „Wyjazd”.
- **Private:** your data stays on your phone. The only place it goes is
  your own intervals.icu account.

The full plan is in [`docs/`](docs/00_index.md).

---

## 1. What you need

| Item | Notes |
|---|---|
| iPhone (iOS 16.4+) or Android phone | Safari on iPhone, Chrome on Android |
| A free **intervals.icu** account | Link Garmin, MyWhoosh and Wahoo to it |
| intervals.icu **API key** | intervals.icu → Settings → Developer |

## 2. Install on the iPhone (2 minutes)

1. Open **https://jakubmamok13.github.io/EveryDay/** in **Safari**.
2. Tap **Udostępnij** (Share) → **Do ekranu początkowego** (Add to Home Screen) → **Dodaj** (Add).
3. Open EveryDay **from the new icon**. Always use the icon from now on:
   Safari and the icon keep separate data.
4. Paste your **intervals.icu API key** and finish the 9 short onboarding
   steps. The app downloads 6 months of history and plans 4 weeks.

Want to look around first? Tap **Najpierw wypróbuj demo** to use simulated
data. Demo data is kept separate from your own. Leave the demo in
**Ustawienia → Wyjdź z demo**.

Android: open the link in Chrome, then menu → **Zainstaluj aplikację**
(Install app).

## 3. Morning reminder (iPhone Shortcut, one time)

1. Open the **Skróty** (Shortcuts) app → **Automatyzacja** (Automation) → **+**.
2. Choose **Pora dnia** (Time of Day): e.g. 07:00, **Codziennie** (Daily).
3. Turn on **Uruchom natychmiast** (Run Immediately).
4. Add the action **Pokaż powiadomienie** (Show Notification) with the text „Czas na poranny check-in 🚴”.
5. Each morning, tap the notification, then tap the **EveryDay** icon.

The same guide, with your chosen time, is in **Ustawienia → Poranne przypomnienie**.

## 4. Everyday use

- **Dziś (Today):** choose W domu (indoors) or Na zewnątrz (outdoors), then
  tap how you feel. The brief and workout appear right away. Changes are
  explained, and **Cofnij** (Undo) restores the plan.
- **Trener (Coach):** Mam mniej czasu · Lżej dziś · Dziś odpoczynek · Przesuń na jutro ·
  Coś boli · Wyjazd · Dlaczego ten trening? · Baza wiedzy (the coaching notes).
- **Tydzień (Week):** move, swap, skip or restore workouts.
- **Postęp (Progress):** fitness, form, FTP and W/kg, and the road to your long-ride target.
- The app syncs with intervals.icu each time you open it. Your devices get
  the plan from intervals.icu even when the app is closed.

## 5. Your data

- Everything is stored **on this phone only**. Make a copy from time to
  time: **Ustawienia → Eksportuj kopię** (save it to Files or iCloud).
  **Wczytaj kopię** restores it, on this phone or a new one.
- The API key never leaves the phone, except in requests to intervals.icu.
  It is not included in the export.
- **Usuń wszystkie dane** deletes everything from the phone. Your data in
  intervals.icu stays.

## 6. If something is wrong

- „Problem z intervals.icu: klucz API odrzucony” → **Ustawienia → intervals.icu → Zmień klucz API**.
- A workout did not reach a device → the workout card shows „nie wysłano ✖”.
  The app retries on the next open. Use the **.zwo** button as a fallback for MyWhoosh.
- **Ustawienia → System** shows the last daily job and the last sync.

---

## For developers

```bash
npm install
npm test            # engine + core tests (core runs on sql.js in Node)
npm run typecheck
npm run dev         # Vite dev server (demo works without intervals.icu)
npm run build       # static files in apps/web/dist
```

Structure:

- `packages/engine`: rule-based Plan Engine (pure TypeScript).
- `packages/core`: database (sql.js), intervals.icu sync, morning flow, actions, catch-up jobs and the in-process router. It runs in the browser.
- `apps/web`: the React PWA, with IndexedDB persistence and a service worker.
- `library/workouts`: 40 workouts.
- `knowledge/method-notes`: Polish coaching notes, bundled into the app.

Every push to `master` runs the typecheck and the tests, then deploys to
GitHub Pages (`.github/workflows/pages.yml`). One-time setup: repository
**Settings → Pages → Source: GitHub Actions**.
