# 03 — Technical Architecture

Status: **DRAFT** — D-002 one user · D-004 intervals.icu · D-011 rules + AI adjust · D-012 all on PC · D-013 Qwen 3.8

## Known constraints

- Web app (browser UI).
- One user (D-002). Data stored persistently on the "account" (where:
  Q-ARC-05).
- Coach AI runs on the author's PC (D-003).
- Data comes from intervals.icu via a personal API key (D-004). Polling is
  enough; webhooks are optional.

## Deployment shape — DECIDED: option 2 (D-012)

| Option | How | + | − |
|---|---|---|---|
| **1. All on the PC** | Local web app at `localhost`; DB file on disk; AI via Ollama/WebGPU | €0, simplest, fully private | Phone sees nothing unless the PC is on and reachable |
| **2. PC + private access from phone** | Same as 1, plus a private tunnel (e.g. Tailscale) so the phone opens the PC's app | €0, phone works anywhere | PC must be on in the morning (or schedule the brief overnight) |
| **3. Small cloud server + AI on PC** | Server holds DB + UI + sync; PC runs the AI and pushes the brief up | Phone works even when the PC is off; brief cached | €3–6/month; two parts to maintain |

Note: the brief can be generated **the evening before** or **early morning on
a schedule**, so a PC that is on at night (or wakes for it) is enough. The
plan itself (rules) can run anywhere.

## Proposed principle: split "brain" from "voice"

| Layer | Job | Tech nature |
|---|---|---|
| **Plan Engine** | Generate and adapt the Training Plan; compute Load, Fitness, Fatigue, Form and Readiness; **validate any AI proposal** against the safe envelope (D-011) | Deterministic rules + math based on Coggan & Allen (D-010). Testable, explainable, cheap; same input gives the same output |
| **Coach AI** | Turn the engine's decision + reasons into the short Daily Brief; Coach Chat (D-019); grounded in the Knowledge Base (D-006, D-022) | Uncensored Qwen 3.8 27B (~4-bit) via Ollama on the AMD RX 7800 XT (D-017, D-026); never invents workouts or numbers; clarity rules (D-021) |

Why: small local models are unreliable at arithmetic and long-horizon
planning, but good at short, friendly explanations of facts they are given.
This also limits the damage of a wrong AI output.

## Building blocks (to decide)

- Frontend: installable PWA (framework TBD), HTTPS inside the tunnel (D-018).
- Backend + DB: accounts, Sources, OAuth tokens, sync jobs, plan storage.
- Sync worker: webhooks + scheduled polling per Source.
- FIT parser (S07).
- Coach AI runtime: in-browser WebGPU vs self-hosted server model (S06).
- Hosting: region EU (GDPR), budget TBD.

## Open questions

- **Q-ARC-01** Any preferred stack or language you know / want to learn?
- **Q-ARC-02** Hosting budget per month you accept (0 € / ≤10 € / ≤50 €)?
- **Q-ARC-03** Do you build it yourself (with Claude), or with other people?
- **Q-ARC-04** Offline use needed (e.g. view today's workout without internet)?
- ~~Q-ARC-05~~ → D-012 (option 2: all on PC + tunnel).
- ~~Q-ARC-06~~ → D-017: AMD RX 7800 XT 16 GB, 32 GB RAM.
- ~~Q-ARC-07~~ → D-011 (rules decide, AI may adjust within limits).
- ~~Q-ARC-08~~ → PC on 24/7 (D-012).
- ~~Q-ARC-09~~ → D-017.
- **Q-ARC-10** PC operating system: Windows or Linux? (Affects the AMD runtime: ROCm vs Vulkan.)
- ~~Q-ARC-11~~ → D-026 (uncensored Qwen 3.8; official as fallback).

## Runtime overview (D-012)

```
                         Author's PC (24/7)
 ┌────────────────────────────────────────────────────────────────┐
 │  Web app (UI + API) ── DB (local file / embedded DB)            │
 │       │                                                        │
 │  Sync worker ── polls intervals.icu (rides, wellness)          │
 │       │         writes Planned Workouts to intervals.icu        │
 │  Plan Engine (rules, Coggan & Allen)                           │
 │       │  facts + decision                                       │
 │  Coach AI ── Ollama on RX 7800 XT (Qwen 3.8) + Knowledge Base  │
 │       │                                                        │
 │  Scheduler: sync → adapt → draft brief → web push              │
 └───────┬──────────────────────────────┬─────────────────────────┘
         │ private tunnel, HTTPS          │ outbound only
     Phone (PWA) / PC browser      Web Push service ─► phone notification
```
