# docs/

Canonical planning documents for the app. No code is written until these
are agreed (see DECISIONS.md, D-001).

Note: the original template targeted single-user desktop apps. This app is
a **phone-only web app (PWA)** with all data on the phone (D-043), so 03/07/08
also cover static hosting, on-device storage, privacy and third-party API terms.
No personal data goes into these docs (D-046): examples use a sample athlete.

```
00_index.md                   Running index of all docs and their status
01_product_vision.md          What the app is, who it's for, core concepts
02_feature_modules.md         Capabilities grouped by module/area
03_technical_architecture.md  Stack, framework, runtime, platform support
04_data_model.md              Entities, schema, relationships, derived data
05_settings.md                User-configurable surface
06_ux_interface.md            Visual language, layout, interactions
07_integrations.md            External services, file formats, device APIs
08_error_logging_feedback.md  Operational concerns, observability
09_v1_build_plan.md           Phased scope and sequencing
10_feature_research.md        Market research: training features users value
DYSK-GOOGLE.md                Guide (PL): Google OAuth client for the Drive copy

glossary.md                   Canonical terms for the project
spikes.md                     Things assumed to work that need verification
DECISIONS.md                  Decision log (what was decided, why, when)
```

## Rules

- **glossary.md is required.** Every domain term, internal concept name and
  UI label with a technical counterpart lives there with a one-line
  canonical definition. All other docs use the canonical term.
- **spikes.md tracks unverified assumptions.** Each spike resolves into a
  confirmed assumption (moves to the architecture doc), a confirmed problem
  (becomes a decision in DECISIONS.md), or a deferred risk (stays, with a note).
- **Splitting:** when a doc passes ~3–5k words, split it
  (`02_feature_modules.md` → `02a_…`, `02b_…`) and leave a stub pointing to
  the children. Numeric prefixes keep ordering stable.
- **Open questions** are tracked inside each doc under "Open questions",
  with an ID (e.g. `Q-VIS-03`) so we can refer to them in conversation.
