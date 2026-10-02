# 03 — Technical Architecture

Status: **SPEC v1** — based on D-002, D-004, D-011, D-012, D-017, D-018,
D-026, D-030, D-035. Items marked **[spike]** must be confirmed in Phase 0.

## 1. Shape

One user, one Windows PC that is on 24/7, no cloud server, €0 hosting (D-012).

```
                    Author's PC (Windows, 24/7)
 ┌──────────────────────────────────────────────────────────────────┐
 │  EveryDay server (Node.js, Windows service)                       │
 │   ├─ HTTP API + PWA files (HTTPS, Tailscale certificate)          │
 │   ├─ Sync ── intervals.icu API (read rides/wellness, write plan)  │
 │   ├─ Plan Engine (pure TypeScript, no I/O)                        │
 │   ├─ Coach ── Ollama (localhost:11434) ── Qwen 3.8 on RX 7800 XT  │
 │   │           └─ Knowledge Base (SQLite + vector index)           │
 │   ├─ Push ── Web Push (VAPID) ─────────────────────────────┐      │
 │   └─ Scheduler (night job, notifications, 15-min sync)     │      │
 │  data/  everyday.db · fit/ · backups/ · logs/              │      │
 └───────┬────────────────────────────────────────────────────┼──────┘
         │ Tailscale tunnel (private, HTTPS)                  │ outbound
   Phone (PWA, iOS + Android) / PC browser        Apple / Google push service
                                                        └─► notification on phone
 intervals.icu (cloud) ─► MyWhoosh (KICKR CORE) · Wahoo (BOLT v2) · Garmin (Fenix 8)
```

If the PC is down, devices still have the workouts already in the
intervals.icu calendar. Only the brief, notifications and adaptation stop.

## 2. Brain and voice (D-011)

| Layer | Job | Nature |
|---|---|---|
| **Plan Engine** | Plan generation, Load / Fitness / Fatigue / Form, Readiness, Adaptation, Safe Envelope validation, brief facts | Pure functions, deterministic, unit-tested; Coggan & Allen rules (D-010) |
| **Coach AI** | Writes the brief's text slots, Coach Chat, proposes changes | Uncensored Qwen 3.8 27B via Ollama (D-026); never the source of numbers |

The Coach AI never writes to the database or the calendar directly. It
returns **structured JSON**; the engine validates it and applies it.

## 3. Stack (D-035)

| Part | Choice | Notes |
|---|---|---|
| Language | **TypeScript** everywhere | Claude builds and maintains it |
| Runtime | **Node.js LTS** | Installed on Windows |
| Server framework | Fastify (or Hono) | Small, typed, fast |
| Front-end | **React + Vite**, installable **PWA** | Mobile-first (R8-23); service worker for offline Today (R8-21) and push |
| Database | **SQLite** via built-in `node:sqlite`, one file `data/everyday.db` | SQL migrations in repo (D-039) |
| Vector search | Embeddings in SQLite + cosine similarity in JS (D-039) | Knowledge Base retrieval |
| Embeddings | Multilingual embedding model in Ollama (e.g. bge-m3) **[spike]** | Polish + English text |
| LLM | **Ollama for Windows** (AMD ROCm/HIP); LM Studio (Vulkan) as fallback **[spike S22]** | Qwen 3.8 27B uncensored, ~4-bit |
| Push | Web Push with VAPID keys | iOS 16.4+ (Home Screen PWA) + Android Chrome |
| Tunnel + HTTPS | **Tailscale Serve** → `https://<pc>.<tailnet>.ts.net` → app on localhost (D-039) **[spike S20]** | No public port |
| Windows service | Auto-start at boot (e.g. NSSM, node-windows or a startup task) **[spike]** | Restarts on crash and after Windows Update |

## 4. Repository layout (proposal)

```
/apps/server            HTTP API, scheduler, sync, push, Windows service files
/apps/web               React PWA (Polish UI)
/packages/engine        Plan Engine: load, readiness, planner, adapter, validator (pure)
/packages/coach         Ollama client, prompts, output validator, RAG
/packages/shared        Types shared by server and web
/library/workouts       Workout Library (~40 workouts, data files, our content)
/knowledge/method-notes Method Notes (our Polish text, in git)
/docs                   These planning docs
/data                   Runtime data — gitignored
/private                The book and anything private — gitignored
```

## 5. Jobs and timing (Europe/Warsaw time, DST-safe)

| Job | When | Steps |
|---|---|---|
| **Night** | 03:00 daily | Full sync (rides, wellness, FIT) → duplicates guard → Load, Fitness, Fatigue, Form → missed-workout rule → plan maintenance (keep 4 weeks planned) → calendar writes for the next 7 days (default Ride Mode) → FTP / Long Ride proposals → DB backup |
| **Day sync** | every 15 min, 05:00–23:00 | New rides → match to Planned Workout → compliance → Ride Rating prompt |
| **Notification** | per-day time (D-034) | Web push |
| **Check-in** | on submit | Readiness → Adaptation → calendar write (chosen variant) → brief (AI slots, ~10–30 s) |
| **No check-in** | notification + 2 h | Garmin-only Readiness → brief (R8-16) |
| **Catch-up** | at server start | If a night job was missed (PC was off), run it now |

## 6. Coach AI pipeline

1. Engine builds **facts JSON** (today's workout, targets in W / HR, Readiness
   and reasons, adaptation, tomorrow, fueling numbers, active Chat Notes).
2. Retrieve 2–3 (brief) or up to 5 (chat) Knowledge Base passages.
3. Prompt (Polish system prompt: friendly buddy, clear, no disclaimers, no
   numbers that are not in the facts) → Ollama `/api/chat` with a JSON
   output schema. `num_ctx` is set explicitly; the default truncates input.
4. **Validator:** JSON shape; slot length (≤ 160 characters each); every
   number in the text must appear in the facts; language looks Polish;
   banned-phrase list (hedging, disclaimers). Fail → one retry with a
   stricter prompt → else template text for that slot.
5. Chat change requests: the model returns `propose_change` / `save_note`
   tool calls → the engine validates (Safe Envelope) → applied with Undo, or
   refused with a reason the model then explains.

GPU sharing: Ollama keeps the model loaded for a few minutes after use
(`keep_alive`) and then frees the GPU, so games and other GPU apps still
work. The first request after unloading takes longer (model load).

## 7. Security and privacy

- Server listens **only on localhost and the Tailscale interface**; no port
  forwarding, no public URL.
- HTTPS with the Tailscale certificate (needed for the service worker and push).
- Password hashed (scrypt, built into Node — D-039); "remember this device" = long-lived HTTP-only
  session cookie; sessions listed and revocable in Settings.
- intervals.icu API key stored **encrypted** on disk (Windows DPAPI or a
  local key file outside the repo) **[spike]**.
- **No health data in logs** (08).
- AI runs locally; no data leaves the PC except to intervals.icu (by design)
  and push payloads (short notification text only, no health data).

## 8. Platform notes (Windows, D-030)

- Disable sleep; set "restart apps after sign-in"; the service starts
  without user login.
- Ollama for Windows on the RX 7800 XT: ROCm/HIP support to verify; LM
  Studio with Vulkan as fallback (S22).
- Backups: nightly copy of `everyday.db` (SQLite backup API) to
  `data/backups/` (keep 14 daily + 8 weekly). An optional second location
  (another disk or a synced cloud folder) can be set in Settings.

## Open questions

None blocking. Technical confirmations: S05, S14, S18, S20, S21, S22 and the
[spike] items above.
