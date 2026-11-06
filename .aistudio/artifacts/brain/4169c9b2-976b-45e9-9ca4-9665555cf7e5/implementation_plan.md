# Analiza Obciążenia Treningowego, Detekcja Przeciążenia i Poranne Powiadomienia PWA

Kompleksowa modernizacja silnika analitycznego obciążenia w EveryDay: wdrożenie wskaźnika ostrego do chronicznego obciążenia (ACWR), detekcji przeciążenia metaboliczno-mięśniowego z Garmina (Overreaching / Przeciążenie) oraz natywnego mechanizmu porannych powiadomień Web Push / Service Worker PWA o godzinie 07:30.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Na podstawie odpowiedzi udzielonych w wywiadzie (Phase 1) zatwierdzono kluczowe decyzje projektowe:

- **Potwierdzona Decyzja 1 (Powiadomienia)**: Wdrożenie bezpośrednich powiadomień systemowych PWA (Web Notifications API / Service Worker) o poranku z prośbą o wypełnienie samopoczucia i sprawdzenie odprawy dnia.
- **Potwierdzona Decyzja 2 (Reakcja na Przeciążenie)**: Gdy Garmin zgłasza stan *Przeciążenie* (Overreaching / High Acute Load) lub gdy kalkulacja ACWR przekracza próg ryzyka (> 1.40–1.50), algorytm natychmiast drastycznie obniża gotowość (blokuje status zielony) i uniemożliwia realizację mocnych jednostek (Sweet Spot, Threshold, VO2max), zamieniając je na regenerację Z1 lub dzień wolny.
- **Potwierdzona Decyzja 3 (Godzina poranna)**: Domyślny czas powiadomienia ustawiony na **07:30**, z pełną możliwością konfiguracji i testu powiadomienia w zakładce *Ustawienia*.

---

## 1. Overview & Core Concept

### Problem
Na zrzutach ekranu użytkownika zidentyfikowano krytyczną niespójność fizjologiczną:
1. **Garmin Connect** informuje: *Stan wytrenowania: Przeciążenie (czerwony alert)*, *Obciążenie: Wysoka*, *Mało spokojnych ćwiczeń aerobowych*, *Gotowość treningowa niska (30)*.
2. **EveryDay** wyświetlało: *Gotowość: 100 (dobra · HRV w normie, pełnia sił)*.

Powód: dotychczasowy algorytm EveryDay oceniał jedynie izolowane poranne punkty (HRV w normie, RHR w normie, subiektywny check-in bez zaznaczonego wyczerpania), zupełnie pomijając **kumulację ostrego obciążenia z ostatnich 3–7 dni** oraz stan przeciążenia raportowany przez ekosystem Garmina i wskaźnik ACWR (Acute:Chronic Workload Ratio).

### Rozwiązanie
1. **Wdrożenie modułu zaawansowanej analityki obciążenia**:
   - Wyliczanie **ACWR (Acute-to-Chronic Workload Ratio)** z wykorzystaniem wykładniczo ważonych średnich (EWMA) obciążenia ostrego (7 dni) i chronicznego (28 dni).
   - Wprowadzenie progu ostrzegawczego ACWR $\ge 1.35$ (*caution*) oraz strefy niebezpiecznej $\ge 1.50$ (*bad / overload*).
   - Odczyt i uwzględnienie stanu **Garmin Training Status** oraz **Garmin Acute Training Load** z danych intervals.icu (status *Overreaching* / *Unproductive* / *Przeciążenie* wywołuje override `overload`).
   - Penalizacja gotowości: przy wykrytym przeciążeniu gotowość spada z „100” do poziomu ostrzegawczego (maks. 25–40 pkt, stan żółty lub czerwony), blokując intensywne akcenty.
2. **Natywne powiadomienia systemowe PWA o poranku**:
   - Integracja z Web Notifications API i Service Workerem.
   - Zaplanowany mechanizm powiadamiania o 07:30 (lub innej godzinie wybranej przez zawodnika).
   - Karta konfiguracji i testu powiadomień w ekranie *Ustawienia* wraz z instrukcją dla iOS (Safari PWA Home Screen) oraz Androida.

---

## 2. User Experience & Visual Design

### Główne przepływy użytkownika

```
┌────────────────────────────────────────────────────────────────────────┐
│ 07:30 Poranne powiadomienie systemowe PWA                              │
│ "EveryDay: Czas na poranny meldunek gotowości 🚴"                      │
│ "Sprawdź formę, tętno spoczynkowe i plan treningu na dziś."            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Kliknięcie powiadomienia
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Ekran "Dziś" (Today)                                                   │
│ ────────────────────────────────────────────────────────────────────── │
│ [Karta Gotowości]                                                      │
│  ● Ostrzeżenie: Przeciążenie treningowe (Garmin: Przeciążenie · ACWR 1.52)│
│  Wynik: 35 / 100 (Stan żółty/czerwony)                                 │
│                                                                        │
│ [Odprawa Trenera]                                                      │
│  "Wykryto wysoką kumulację zmęczenia z ostatnich dni. Silnik zablokował│
│   zaplanowany akcent Sweet Spot. Dziś regeneracja Z1 lub wolne."       │
└────────────────────────────────────────────────────────────────────────┘
```

### Visual Identity & Anty-Slop
- Zgodnie z wytycznymi designu zachowujemy stonowany, minimalistyczny styl EveryDay: brak cukierkowych badge'y i sztucznych gradientów.
- Wskaźniki obciążenia (ACWR, stan Garmina) prezentowane jako czysty, czytelny tekst z separatorami typograficznymi (`·`).
- W zakładce *Ustawienia* dodana elegancka sekcja **Powiadomienia poranne**:
  - Przełącznik aktywności powiadomień.
  - Pole wyboru godziny (domyślnie `07:30`).
  - Przycisk `Wyślij powiadomienie testowe` umożliwiający natychmiastowe sprawdzenie uprawnień w przeglądarce.

---

## 3. Key Product Decisions & Trade-Offs

### Decyzja 1: Wdrożenie ACWR (Acute:Chronic Workload Ratio) i wykładniczego modelu zmęczenia
- **Podejście**: Wzbogacenie kalkulatora obciążenia (`load.ts` i `readiness.ts`) o obliczanie stosunku ostrego obciążenia (ostatnie 7 dni) do chronicznego (ostatnie 28 dni).
- **Dlaczego**: Pozwala matematycznie wychwycić nagły skok objętości lub intensywności, nawet jeśli poranne HRV pojedynczego dnia jeszcze nie spadło drastycznie.
- **Wpływ na silnik**: ACWR > 1.40 skutkuje obniżeniem gotowości i zaleceniem lżejszej jednostki; ACWR > 1.50 nakłada blokadę `overload`.

### Decyzja 2: Integracja sygnału „Przeciążenie” z Garmina jako twardy Override
- **Podejście**: Jeśli Garmin raportuje *Przeciążenie* (Training Status = Overreaching) lub *Training Readiness* < 35, system EveryDay nie może ignorować tego faktu i pokazywać 100/100.
- **Dlaczego**: Garmin analizuje całodobowe tętno, dynamikę snu, EPOC z ćwiczeń i obciążenie mięśniowe. Wprowadzenie override `overload` obniża gotowość do strefy żółtej/czerwonej i chroni zawodnika przed przetrenowaniem lub kontuzją.

### Decyzja 3: Mechanizm powiadomień bez zewnętrznego serwera backendowego
- **Podejście**: Wykorzystanie Web Notifications API zarejestrowanego w Service Workerze (`navigator.serviceWorker.ready`) oraz harmonogramu timerów/alarmów w PWA, wspieranego pamięcią lokalną i możliwością wywołania powiadomienia testowego.
- **Dlaczego**: Zgodnie z architekturą EveryDay (D-043: brak serwera, aplikacja działa w całości lokalnie w telefonie z darmowym hostingiem statycznym).

---

## 4. Technical Architecture & Data Strategy

### Diagram Architektury Przepływu Danych Obciążenia

```
┌────────────────────────────────────────────────────────┐
│                     intervals.icu                      │
│ (Garmin Wellness, Body Battery, Training Readiness,     │
│  Acute Load, ATL, CTL, Garmin Training Status)         │
└───────────────────────────┬────────────────────────────┘
                            │ GET /athlete/{id}/wellness
                            ▼
┌────────────────────────────────────────────────────────┐
│ EveryDay Core Data Mapper (`icu.ts` & `sync.ts`)       │
│  - Odczytuje: garminReadiness, bodyBattery, atl, ctl,  │
│    garminTrainingStatus, acuteLoad                     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Engine: Analiza Obciążenia i Gotowości                │
│                                                        │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │ `load.ts`: ACWR Calc  │   │ `readiness.ts`       │  │
│  │ Acute: 7d EWMA        │──►│ - rateAcwr()         │  │
│  │ Chronic: 28d EWMA     │   │ - rateGarminStatus() │  │
│  │ Stosunek ACWR         │   │ - override 'overload'│  │
│  └───────────────────────┘   └──────────┬───────────┘  │
└─────────────────────────────────────────┼──────────────┘
                                          │
                                          ▼
┌────────────────────────────────────────────────────────┐
│ Silnik Reguł Adaptacji (`rules.ts`)                    │
│  - Wykryty stan 'overload' / ACWR > 1.40               │
│  - Blokada Key Workout (Sweet Spot / Próg / VO2max)    │
│  - Zamiana na Dzień Wolny lub Regenerację Z1 (40 min)  │
└────────────────────────────────────────────────────────┘
```

### Planowane Zmiany w Modułach:
1. `packages/shared/src/types.ts`:
   - Rozszerzenie typu `WellnessDay` o `garminTrainingStatus?: string | null`, `acuteLoad?: number | null`, `chronicLoad?: number | null`.
   - Dodanie typu `overload` do `Readiness["overrides"]` oraz kluczy `acwr` i `garmin_status` do `ReadinessInput["key"]`.
2. `packages/engine/src/load.ts`:
   - Dodanie kalkulatora `computeAcwr(loads: Map<ISODate, number>, date: ISODate): { acute: number; chronic: number; acwr: number; risk: "optimal" | "caution" | "danger" }`.
3. `packages/engine/src/readiness.ts`:
   - Dodanie ewaluatorów `rateAcwr` oraz `rateGarminTrainingStatus`.
   - Obsługa override `overload`: blokada wysokiej gotowości (obniżenie do $\le 35$), status `yellow` lub `red`.
4. `packages/engine/src/rules.ts` & `packages/core/src/services/daily.ts`:
   - Reakcja na `overload`: wymuszenie redukcji/zamiany mocnych akcentów na aktywny odpoczynek Z1 lub wolne.
5. `apps/web/public/sw.js` & `apps/web/src/reminder.tsx` & `Settings.tsx`:
   - Wdrożenie obsługi powiadomień PWA (Web Notification API) w Service Workerze (`showNotification`, obsługa kliknięcia otwierającego aplikację).
   - W ustawieniach: formularz konfiguracji godziny przypomnienia (domyślnie 07:30) oraz przycisk testowy z prośbą o uprawnienia systemowe.
