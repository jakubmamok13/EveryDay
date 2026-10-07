# 00 — Index

Last updated: 2026-10-07

| Doc | Status | Notes |
|---|---|---|
| [README](README.md) | Done | Conventions |
| [01 Product vision](01_product_vision.md) | **Spec v1.1** | Personal tool on the phone, Polish, Coggan method, reference setup + example zones |
| [02 Feature modules](02_feature_modules.md) | **Spec v1.2** | 13 modules: plan, one-tap readiness, brief, delivery, Trener buttons, FTP, long rides; season, green light, power profile (D-049 … D-065) |
| [03 Technical architecture](03_technical_architecture.md) | **Spec v1.1** | Phone only: PWA on GitHub Pages, sql.js + IndexedDB, catch-up jobs |
| [04 Data model](04_data_model.md) | **Spec v1.2** | All tables + formulas; schema v4 (season events, week override, power peaks); JSON export / import |
| [05 Settings](05_settings.md) | **Spec v1.2** | Availability, season events, reminder (Shortcut), intervals.icu, data |
| [06 UX & interface](06_ux_interface.md) | **Spec v1.2** | Screens, one-tap check-in, Trener, new cards, Polish copy rules |
| [07 Integrations](07_integrations.md) | **Spec v1.1** | intervals.icu hub, called from the phone; API fields to confirm (S05) |
| [08 Errors, logging, feedback](08_error_logging_feedback.md) | **Spec v1.1** | "Brief always arrives"; safety rails |
| [09 v1 build plan](09_v1_build_plan.md) | **v1.2 built** | Phase 0 setup + spikes, Phases 1–7 |
| [10 Feature research](10_feature_research.md) | **Done** | Training features users value in 14 apps; 15 options chosen and built (D-049) |
| [Dysk Google](DYSK-GOOGLE.md) | **Guide (PL)** | One-time Google OAuth client for the Drive copy (D-068) |
| [Glossary](glossary.md) | **Spec v1.2** | Canonical terms + Polish UI labels |
| [Spikes](spikes.md) | Active | 31 spikes; S05, S14, S18, S26, S27 high risk; S29 power streams; AI/PC spikes closed |
| [Decisions](DECISIONS.md) | Active | D-001 … D-068 (D-043 – D-046: phone only, no AI, Shortcut reminder, no personal data; D-047 other sports; D-048 why card; D-049 – D-065 research features) |

## Interview progress

- Round 0 — initial idea: captured in 01.
- Round 1 — scale, local AI, integrations, goals: **done** → D-002 … D-005.
- Round 2 — "book" meaning, where the brief is read, PC hardware, workout delivery: **done** → D-006 … D-009.
- Round 3 — method/book, who decides the plan, PC uptime, language: **done** → D-010 … D-013.
- Round 4 — adaptation mode, check-in, tone: **done** → D-014 … D-016.
- Round 5 — profile, devices, GPU, book, notifications, chat, indoor/outdoor, clarity: **done** → D-017 … D-022.
- Round 6 — outdoor power, indoor recording, phone, model: **done** → D-023 … D-026.
- Round 7 — days, weekend length, FTP / weight / goal, PC OS, outdoor recorder, intervals.icu, notifications: **done** → D-027 … D-032.
- Round 8 — long-ride target, notification time, coding, FTP updates: **done** → D-033 … D-036.
- Round 9 — 24 proposed defaults: **approved** → D-037.
- All docs written to **Spec v1** (2026-10-02).
- Round 10 — phone only, no AI, buttons, Shortcut reminder, remove personal data: **done** → D-043 … D-046.
- Round 11 — other sports, why card, app research, 15 research features: **done** → D-047 … D-065.

## Build status

**v1.2 is built** (2026-10-06): a phone-only PWA with the research
features A1 … D3. Code in `packages/`, `apps/web`, `library/`, `knowledge/`;
75 automated tests; demo mode in the browser. How to install on the phone: [`README.md`](../README.md). What is
verified and what still needs the real account:
[09 § Build status](09_v1_build_plan.md#build-status-2026-10-02-v11).

## Next step

The author opens the app on the iPhone, adds it to the Home Screen,
connects intervals.icu (new API key) and uses it for a few mornings. The
spikes S05, S14, S18, S21, S26, S27, S29, S31 are then closed from that real use.
