# 08 — Errors, Logging & Feedback

Status: **SKELETON**

Topics to define:
- **Windows host (D-030):** auto-start after reboot / Windows Update; sleep
  disabled; a health check that alerts (via the daily notification) if
  sync or the AI was down overnight; the brief falls back to a rule-based
  template if Ollama is not responding.
- Sync failures (expired tokens, API limits, Source outages) and how the user is told.
- Missing data days (no wearable worn): Readiness falls back to check-in + load.
- Plan Engine safety rails: max weekly load ramp, illness rule, "see a doctor" triggers.
- Coach AI guardrails: the brief may only state numbers supplied by the
  Plan Engine; fallback to a template brief if the model fails.
- Error tracking and logs, with **no health data in logs**.
- In-app feedback: thumbs up/down on each brief or adaptation ("too hard / too easy").

## Open questions

- **Q-ERR-01** Should the user be able to rate each workout (RPE / "too
  hard") to train the adaptation?
