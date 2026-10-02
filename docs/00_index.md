# 00 — Index

Last updated: 2026-10-02

| Doc | Status | Notes |
|---|---|---|
| [README](README.md) | Done | Conventions |
| [01 Product vision](01_product_vision.md) | **Spec v1** | Personal tool, Polish, Coggan method, author profile + zones |
| [02 Feature modules](02_feature_modules.md) | **Spec v1** | 13 modules: plan, readiness, brief, delivery, chat, FTP, long rides |
| [03 Technical architecture](03_technical_architecture.md) | **Spec v1** | All on Windows PC, TypeScript, SQLite, Ollama, Tailscale |
| [04 Data model](04_data_model.md) | **Spec v1** | All tables + formulas |
| [05 Settings](05_settings.md) | **Spec v1** | Per-day availability + notifications |
| [06 UX & interface](06_ux_interface.md) | **Spec v1** | Screens, states, Polish copy rules |
| [07 Integrations](07_integrations.md) | **Spec v1** | intervals.icu hub; API fields to confirm (S05) |
| [08 Errors, logging, feedback](08_error_logging_feedback.md) | **Spec v1** | "Brief always arrives"; safety rails |
| [09 v1 build plan](09_v1_build_plan.md) | **Spec v1** | Phase 0 setup + spikes, Phases 1–6 |
| [Glossary](glossary.md) | **Spec v1** | Canonical terms + Polish UI labels |
| [Spikes](spikes.md) | Active | 23 spikes; S05, S06, S14, S16, S18, S22 high risk |
| [Decisions](DECISIONS.md) | Active | D-001 … D-038 (D-008 superseded) |

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

## Next step

**Phase 0** (09_v1_build_plan.md): the author sets up intervals.icu (+ Garmin,
MyWhoosh, Wahoo), Ollama and Tailscale; then the spikes run on the real setup.
No application code before Phase 0 results are written back into these docs.

Progress: intervals.icu account + API key ✔ · Garmin / MyWhoosh / Wahoo
linked ✔ · calendar → devices delivery ✔ (manual test) · Tailscale on phone ✔
· PC steps waiting for PC access · API checks moved to Phase 1 on the PC (D-038).
