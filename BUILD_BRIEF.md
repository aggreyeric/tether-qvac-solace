# BUILD BRIEF — Tether QVAC Hackathon

> **Status:** RESEARCH COMPLETE. Build plan ready for Eric's approval.
> **Author:** hack_2 (research + brief). Do **NOT** submit anything — Eric approves first.
> **Drafted:** 2026-06-20 (Sat). Sprint window: ~Sat 20 → Tue 23 Jun 2026.

---

## ⚠️ First: what "QVAC" actually is (the guess in the task was wrong)

The task guessed *"Quantum-Verified AI Compliance."* **That is incorrect.** Confirmed from
official Tether sources (qvac.tether.io, tether.io news, github.com/tetherto/qvac):

> **QVAC = Tether's open-source, cross-platform SDK for building local, private, peer-to-peer AI
> applications.** Tagline: *"Infinite Stable Intelligence — Decentralized, Local AI in a Single
> API."* Run LLMs, STT, translation, TTS, OCR, image-gen, RAG **locally** on Linux / macOS / Windows
> / Android / iOS — no cloud, no API keys, data never leaves the device.

The hackathon is about **building apps with the QVAC SDK** — local-first / private / P2P AI — not
"compliance."

---

## 🏆 Hackathon details

| | |
|---|---|
| **Hackathon** | Tether QVAC Hackathon |
| **Platform** | DoraHacks |
| **URL** | `https://dorahacks.io/hackathon/tether-qvac` *(confirmed — slug resolves)* |
| **Prize pool** | **~$21,000** (per HICLAW_MANAGER) — ✅ use this unless the page shows otherwise |
| **Deadline** | **Jun 23, 2026** (~3 days from brief) |
| **Sponsor / stack** | Tether AI — the **QVAC SDK** (`@qvac/sdk`) |
| **Official QVAC site** | https://qvac.tether.io |
| **Docs** | https://docs.qvac.tether.io/quickstart/ |
| **GitHub** | https://github.com/tetherto/qvac (Apache-2.0; TS 35% / JS 32% / C++ 25% / Python 6%) |
| **License** | Apache-2.0 |

> ⚠️ **TO CONFIRM on the live DoraHacks page** (it is Cloudflare/Turnstile-gated from this
> environment — I could not scrape it): the **exact track names + per-track bounty split**, the
> **judging rubric**, and the **submission format** (repo link? demo video required? team size?).
> **Eric/HICLAW_MANAGER:** please open `https://dorahacks.io/hackathon/tether-qvac` in a normal
> browser and paste the "Tracks/Prizes", "Judging Criteria", and "How to submit" sections. The
> build plan below is robust to the exact track split because the recommended project hits the
> **3 most likely tracks** at once (local-AI, P2P, Machine-Economy).

**Likely tracks (inferred from QVAC's own product pillars — confirm):**
1. **Best local / private AI app** (data never leaves device)
2. **Best P2P / decentralized AI** (Holepunch peer networking)
3. **Best Machine Economy / autonomous agent** (agents transacting in BTC/USDt via WDK)
4. *Wildcard:* Best use of **TurboQuant** (KV-cache memory compression) or **mobile/edge** deployment.

---

## 🧠 QVAC technical landscape (what we can build on)

**Capabilities exposed by the SDK (`@qvac/sdk`, npm) — all LOCAL, single unified API:**
- **LLM completion** (streaming) — engine: **Fabric LLM** (Vulkan, hardware-agnostic, first to do
  **LLM fine-tuning on mobile**)
- **Embeddings** + **out-of-the-box RAG**
- **Speech-to-text** (Whisper / NVIDIA Parakeet) · **Text-to-speech** (ONNX) · **OCR**
- **Translation (NMT)** · **Image generation** (Stable Diffusion) · **Multimodal**
- **Fine-tuning (LoRA)** locally
- **P2P / decentralized:** delegated inference to peers (Holepunch stack), fetch models from peers
  (distributed registry), blind relays (NAT/firewall traversal)
- **Machine Economy:** AI agents act autonomously; **WDK** (Wallet Dev Kit) lets agents transact in
  **Bitcoin & USDt** with no intermediaries
- **TurboQuant:** open-source KV-cache compression (up to ~5× memory reduction) → longer context /
  larger docs on consumer hardware
- **OpenAI-compatible HTTP API** exposed by the QVAC CLI → drop-in for the broader AI ecosystem

**Developer surface:** `npm install @qvac/sdk` → `loadModel({modelType:"llm"})` →
`completion({modelId, history, stream})`. Cross-platform, one codebase.

---

## 🎯 Recommended primary project

### **"EdgePay Agent" — a private, local AI agent that earns & spends USDt autonomously**

*One sentence:* a fully on-device AI agent (QVAC SDK) that reasons about tasks, **delegates
expensive inference to peers over P2P**, and **settles every task with an autonomous USDt
micropayment** (WDK / x402) — a decentralized, private alternative to renting cloud-AI APIs.

**Why this wins:** it lands on the **three strongest QVAC pillars simultaneously** —
① local/private (agent + secrets never leave the device), ② P2P delegation (Holepunch), and
③ Machine Economy (agents transacting in USDt). It's exactly the "AI that earns and spends" story
Tether markets for QVAC, and it plays to hack_2's lane (AI agents + payments + DeFi).

**Concrete demo (judges can run in 2 min):**
1. You type a task: *"Summarize this 40-page PDF and translate the summary to Spanish."*
2. **Agent A** (on your laptop) plans it, decides its local model is too small for the PDF, and
   **discovers Agent B** (a peer) over P2P that advertises a bigger local model.
3. Agent A **negotiates a price** and **pays Agent B 0.50 USDt** (testnet) for the inference via WDK.
4. Agent B runs the job **locally** (Fabric LLM + TurboQuant for the long doc), returns the result,
   Agent A finishes the translation step locally and answers you.
5. Telemetry panel shows: *0 cloud calls, 0 API keys, data-on-device, 1 P2P settlement.*

**Architecture:**

```
 ┌──────────────── your device (Agent A) ──────────────────┐
 │  QVAC SDK (local LLM) ── planner / tool-caller agent    │
 │        │                                                │
 │        ├── if local model sufficient → do it on-device  │
 │        └── else → P2P discovery (Holepunch) ──────┐     │
 │                                                   │     │
 │   WDK / x402 pay 0.50 USD₮ (testnet) ─────────────┼──►  │  settle
 └───────────────────────────────────────────────────┼─────┘
                                                     ▼
                          ┌──────── peer (Agent B) ─────────┐
                          │  QVAC Fabric LLM + TurboQuant   │
                          │  (bigger local model, long ctx) │
                          │  runs job → returns result      │
                          └─────────────────────────────────┘
```

**Scope for 3 days (MVP, must be real not stubbed):**
- Local agent loop (QVAC SDK) that plans + tool-calls ✅ (my core skill)
- P2P peer discovery + 1 delegated-inference path (Holepunch / QVAC peer APIs)
- Autonomous USDt payment per task (WDK or x402) on **testnet**
- A clean CLI/web demo + a 2-min walkthrough video
- Telemetry proving "local + private + settled"

**Stretch (if time):** TurboQuant toggle to show 5× context handling; a 2nd "seller" agent that
auto-prices jobs.

---

## 💡 Alternative projects (pick by track once confirmed)

| # | Idea | QVAC pillar | Effort | hack_2 fit |
|---|---|---|---|---|
| **1** | **EdgePay Agent** (above) — local agent that earns/spends USDt | Local + P2P + Machine Economy | Med-High | ★★★★★ |
| 2 | **Private Local RAG Vault** — fully on-device document Q&A (STT→embed→RAG→TTS), zero cloud, TurboQuant for big docs | Local / Privacy | Med | ★★★★ |
| 3 | **P2P Inference Bazaar** — marketplace where underused devices sell local GPU/CPU inference to peers, settled in USDt | P2P + Machine Economy | High | ★★★★ |
| 4 | **Offline Field Agent** — mobile (iOS/Android via Expo) agentic assistant that works with no internet, syncs later | Local / Edge / Mobile | Med | ★★★ |
| 5 | **Self-Custody Trading Copilot** — local agent that analyzes your (local-only) wallet data and proposes DeFi actions, executes via WDK | Local + Machine Economy + DeFi | Med | ★★★★★ |

*If the confirmed tracks lean pure "local AI app" with no payments, fall back to **#2** or **#5**.
If they lean "Machine Economy," **#1** or **#3**.*

---

## 🛠️ Tech stack

- **Core:** **QVAC SDK** (`@qvac/sdk`) for all local inference (LLM, embeddings/RAG, STT/TTS).
  Engine: Fabric LLM (+ TurboQuant for long context).
- **Agents:** TypeScript/Node agent loop (matches SDK) — planner + tool-caller, streaming completions.
  *(If a Python agent layer is preferred, QVAC CLI exposes an OpenAI-compatible HTTP API → wrap with
  LangChain/LlamaIndex; but native SDK = TS is the recommended path for max fidelity.)*
- **Payments:** **WDK** (Tether Wallet Dev Kit) or **x402** for per-task USDt micropayments on **testnet**.
- **P2P:** QVAC/Holepunch peer APIs for discovery + delegated inference.
- **Demo/UI:** minimal Next.js or a CLI dashboard; telemetry panel proving local/private/settled.
- **Dev:** Docker for reproducible judge runs, pytest/vitest tests, `docker compose up`.

**Local model to use (fast, fits laptop):** Llama 3.2 1B Instruct (Q4) — it's literally the example
in the QVAC quickstart; scale up on the "seller" peer for the delegation demo.

---

## 📅 3-day sprint plan

| Day | Goal | Deliverable |
|---|---|---|
| **Day 1 (Sun)** | **Stand up QVAC locally + agent loop.** Install SDK, load Llama 3.2 1B, get a streaming local completion + a planner/tool-caller agent working. Confirm the **exact tracks** from the DoraHacks page and lock the project choice. | Local agent answers a task end-to-end on-device. Repo + Docker scaffolded, first commit. |
| **Day 2 (Mon)** | **Add the differentiator.** For EdgePay: P2P discovery + 1 delegated-inference path + USDt payment-per-task (testnet) via WDK/x402. Wire telemetry. | Two agents negotiate + settle a job. Demo path works on laptop. |
| **Day 3 (Tue)** | **Polish & submit-prep.** Telemetry panel, README, 2-min demo video, tests green, `docker compose up` clean. ⛔ Do NOT submit — hand to Eric for approval before deadline. | Submission-ready package; Eric approves before 23 Jun. |

---

## ✅ Definition of done (before handing to Eric)

- [ ] App runs fully **local**: 0 cloud calls, 0 API keys, demo works offline-after-model-download.
- [ ] The QVAC differentiator is *visible in the demo* (local + P2P + Machine Economy, or whichever).
- [ ] README + architecture diagram + 2-min demo video.
- [ ] Tests pass; `docker compose up` runs clean.
- [ ] Clearly states **testnet** for any USDt/BTC (no real funds, no mainnet).
- [ ] ⛔ **Not submitted** to DoraHacks — Eric's approval gate.

---

## 🚧 Blockers / what I need from HICLAW_MANAGER or Eric

1. **Exact DoraHacks track list + judging rubric + submission format** — Cloudflare blocked me from
   scraping `dorahacks.io/hackathon/tether-qvac`. Please paste the Tracks/Prizes + Judging + Submit
   sections from a normal browser so I can lock the project to the highest-value track.
2. **Confirm prize pool is ~$21K** (and any per-track split) vs. the headline number.
3. **Hardware for the demo** — the P2P delegation story is strongest with **2 devices** (laptop +
   phone/2nd machine). If only one machine, I'll simulate the 2nd peer as a local process.
4. **Go/no-go on the primary project (EdgePay Agent)** before Day 1 — or pick an alternative.

---

## 🔗 Key links

- QVAC product: https://qvac.tether.io
- QVAC quickstart: https://docs.qvac.tether.io/quickstart/
- QVAC SDK repo: https://github.com/tetherto/qvac
- Fabric LLM engine: https://github.com/tetherto/qvac-fabric-llm.cpp
- TurboQuant announcement: https://tether.io/news/tether-ai-upgrades-qvac-sdk-bringing-turboquant-to-everyday-devices-giving-local-ai-data-center-sized-memory/
- Hackathon page: https://dorahacks.io/hackathon/tether-qvac
