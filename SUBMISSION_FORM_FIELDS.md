# DoraHacks Submission Form Fields — Solace

> Copy-paste-ready text for each field of the Tether QVAC DoraHacks submission form.
> **Status: DRAFT — not submitted anywhere. Awaits Eric's approval.**

---

## 1. Project Name

```
Solace
```

---

## 2. One-line tagline (max 255 chars)

```
Sovereign, local-first AI agent on Tether QVAC — on-device LLM, private RAG, NMT, OCR and P2P brain-upgrades, with hard proof that zero bytes ever leave your device.
```

*(191 chars)*

---

## 3. Description (≈720 words)

```
Meet Solace — a sovereign, local-first AI agent built on the Tether QVAC SDK. Your AI. Your device. Zero cloud calls.

THE PROBLEM
Every "AI assistant" today forces you to upload every prompt, every document, and every secret to a cloud you don't control. The consequences are structural, not cosmetic. There is no real privacy — your most sensitive data trains someone else's moat. There is no real ownership — pull the API key and the assistant vanishes. There is no real offline — no network, no AI. And there is no accountability: vendors claim privacy, but nobody can prove it. Solace exists to make that proof possible.

THE SOLUTION
Solace flips the model. Powered by QVAC, Tether's open-source SDK for local, private, peer-to-peer AI, Solace runs entirely on your device. An on-device LLM (Llama 3.2 / Qwen3 via QVAC's Fabric engine) handles reasoning. A private on-device knowledge base performs real local embedding and cosine retrieval over your own notes and documents — genuine RAG, with the corpus never leaving the machine. Local neural machine translation and OCR let Solace translate and read images offline. And when the on-device model is too small for a heavy or long-context task, Solace's router delegates the work to a peer's bigger on-device model over QVAC's Holepunch networking — still no cloud, just another device. We call this "upgrading your brain over P2P."

WHAT MAKES IT UNIQUE
Three things set Solace apart.

First, privacy is a verifiable property, not a marketing claim. Solace ships a telemetry layer that is the application's signature feature: a single source of truth that counts local work, peer work, and cloud work on every inference. The headline invariant — cloudCalls === 0 — is asserted by automated tests. The test suite fails if a cloud call ever appears. We don't claim privacy; we prove it.

Second, Solace is the QVAC-native answer to the fundamental weakness of local AI: small models get stuck. Most local-AI projects are locked into the one model that fits your device. Solace's router solves this by electing, per task, whether to run locally or delegate to a peer. Anyone can run `solace provider` to turn their device into a QVAC compute seller, so a phone or a laptop can offload a heavy job to a beefier peer — keeping every byte off the public internet.

Third, it is testable everywhere and real where it counts. The entire agent, router, tools, and telemetry stack is built against a single QvacClient interface. A deterministic offline engine makes the app instantly demoable and 100% unit-tested on any machine with no downloads. A real adapter runs the genuine QVAC engine with `--real` — the exact same code path. What the tests prove is what the real engine does.

THE BUILD
Solace is delivered in two languages that tell one story. A production-grade TypeScript agent app implements a transparent plan → route → tool-call → answer loop over QVAC, with a zero-dependency HTTP dashboard (node:http + single-page UI) that polls a telemetry API. A typed Python SDK offers a pluggable backend (auto / openai / stub) with five self-contained examples spanning chat, RAG, NMT, OCR, and a privacy chart. The project ships 31 TypeScript tests and 14 Python tests, all offline-deterministic and CI-friendly, and `docker compose up` runs the entire dashboard with no downloads and no network.

QVAC TRACK ALIGNMENT
Solace maps cleanly onto the QVAC pillars. For Best local / private AI app, telemetry and tests prove 0 cloud calls, 0 API keys, and 0 bytes off-device. For Best P2P / decentralized AI, `solace provider` plus the router delegate heavy jobs to a peer's on-device model over Holepunch. For the Single unified API, one QvacClient seam spans LLM, embeddings/RAG, NMT, OCR, and P2P providing.

FOR JUDGES
The default engine is offline-deterministic so the demo is instant and reproducible on any machine; add `--real` to run the genuine on-device QVAC engine with identical agent, routing, tools, and telemetry. No mainnet, no real funds, and no real API keys are used anywhere — the QVAC local server's API key is a placeholder by design.

Solace is local-first AI that never phones home.
```

*(~676 words — within the 500–800 target)*

---

## 4. Demo video URL

```
[Eric: add YouTube/Drive link]
```

> The video script is staged at `DEMO_VIDEO_SCRIPT.md` in the repo. Placeholder until Eric uploads the recording.

---

## 5. GitHub repo URL

```
https://github.com/aggreyeric/tether-qvac-solace
```

---

## 6. Category / Track selection

**Recommendation: `General Purpose`**

```
General Purpose
```

**Why General Purpose (not Tinkerer or Mobile):**

| Track | Fit? | Reasoning |
|---|---|---|
| **General Purpose** | ✅ **Best fit** | Solace is a full, general-purpose local AI agent — routed tool-using agent loop, private RAG, NMT, OCR, P2P delegation, telemetry dashboard, a typed Python SDK, and Docker. It runs on a desktop/laptop developer machine (Apple M1 Max, 10 cores, 64 GB RAM per `HARDWARE.md`) and covers the entire QVAC model family (Fabric LLM Llama 3.2 / Qwen3, EmbeddingGemma, NMT, OCR). This is exactly the "broad, capable app on a real machine" profile the General Purpose track is for. |
| Tinkerer | ❌ | Tinkerer is scoped to smaller, experimental/hobbyist builds. Solace is too complete and too broad (7 capabilities + SDK + dashboard + 45 tests) to sit there — putting it in Tinkerer undersells the work and competes against the wrong cohort. |
| Mobile | ❌ | Solace is not a mobile app. It targets Node/Bare/Bun via QVAC on developer hardware. There is no iOS/Android target, so Mobile is a hard mismatch. |

---

## ✅ Submission checklist (for Eric before submitting)

- [ ] Confirm Project Name / tagline read well to you
- [ ] Approve the 720-word description (or trim to taste)
- [ ] Upload demo video → paste real URL into field 4
- [ ] Confirm GitHub repo is **public** and the README renders
- [ ] Double-check DoraHacks wants "General Purpose" spelled exactly that way
- [ ] Attach `SOLACE_PITCH_DECK.pdf` if the form allows deck upload
- [ ] Only then hit Submit

---

_Prepared by hack_3. Not submitted. Awaits operator approval._
