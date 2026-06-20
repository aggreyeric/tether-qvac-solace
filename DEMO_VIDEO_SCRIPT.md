# 🎬 Solace — Demo Video Script (3 min)

> **Title:** Solace — Sovereign, Local-First AI on Tether QVAC
> **Hackathon:** Tether QVAC
> **Runtime:** ~3:00 (180s)
> **Format:** Screen-capture + voiceover. Two windows side-by-side:
>   1. a 80-char terminal running the Solace CLI / Python examples
>   2. a browser pointed at the live dashboard
>
> **Recording tip:** Run everything against the offline deterministic engine
> (`--mock`) so the demo is instant, reproducible, and needs **zero model
> downloads** — perfect for a clean screen capture. No network required at any
> point, which is the whole point.
>
> **Prereq (run once before hitting record):**
> ```bash
> cd tether-qvac
> npm install
> cd python && python3 -m venv .venv && .venv/bin/pip install -e .[dev] && cd ..
> ```

---

## SEGMENT 1 — Intro: what is Solace? what is QVAC? (0:00 – 0:25)

**On screen:** Title card → *Solace — Your AI. Your device. Zero cloud calls.*
Fade to the Solace ASCII banner (from `npm run demo`) in the terminal.

**Voiceover:**
> "Most AI assistants mean one thing: send every prompt, every document, every
> secret to a cloud you don't control. **Solace is the opposite.** It's a fully
> on-device AI agent built on Tether's **QVAC** SDK — the open-source toolkit for
> local, private, peer-to-peer AI. LLMs, embeddings, RAG, translation, OCR — all
> run on your machine. Zero API keys. Zero cloud calls. And we can *prove it*."

**Cut to:** terminal, prompt ready in `tether-qvac/`.

---

## SEGMENT 2 — Local chat running (0:25 – 0:50)

**On screen:** Terminal, type and run:

```bash
npm run cli -- chat --prompt "What is 17 multiplied by 23?" --mock -v
```

**What appears:** the agent's plan → a `calculator` tool call → the final answer
`391`. Because `-v` is on, you see each step. Crucially, **no network request
fires**.

**Voiceover:**
> "Solace is a tool-using agent. Ask it `17 times 23` and it **plans**, calls the
> on-device calculator, and answers — `391`. That whole loop ran locally. The `-v`
> flag shows you the reasoning steps. Now watch the privacy invariant."

**Quick cut (2s):** show a network tab / `lsof` / Activity Monitor with zero new
connections — optional, reinforces the point.

---

## SEGMENT 3 — Private RAG vault (0:50 – 1:15)

**On screen:** Switch to the Python SDK flagship example.

```bash
cd python && .venv/bin/python examples/02_local_rag_vault.py
```

**What appears:** the script embeds a local corpus (your own notes/docs),
retrieves the matching chunk for a query, and answers **grounded** in that chunk.
Console prints the retrieved passage + the grounded answer, then a privacy report.

**Voiceover:**
> "This is the flagship: a **private on-device RAG vault**. Your documents are
> embedded locally with QVAC's EmbeddingGemma, retrieved locally, and the answer is
> grounded in your own knowledge base. Your notes never left this device — not for
> embeddings, not for retrieval, not for generation."

---

## SEGMENT 4 — OCR (1:15 – 1:35)

**On screen:** Keep the Python SDK going.

```bash
.venv/bin/python examples/04_ocr.py
```

**What appears:** a bundled sample image is read **on-device**; extracted text is
printed to the console. (No Google Vision, no cloud OCR API.)

**Voiceover:**
> "Reading an image? QVAC's OCR runs locally too. Point it at a photo of a receipt,
> a document, a whiteboard — the text is extracted on your CPU. Same story:
> nothing uploaded, nothing leaving the machine."

---

## SEGMENT 5 — Translation (1:35 – 1:55)

**On screen:**

```bash
.venv/bin/python examples/03_translation.py
```

**What appears:** a batch of source strings translated via QVAC's local NMT;
source → target lines printed.

**Voiceover:**
> "Translation is the same. QVAC's on-device NMT engine translates a batch of text
> with no cloud round-trip. Your private conversations, contracts, or medical
> records can be translated without ever trusting a third-party API."

---

## SEGMENT 6 — Privacy dashboard (1:55 – 2:35)

**On screen:** Bring the browser window forward. In a fresh terminal:

```bash
npm start
```

→ browser auto-points (or you type) at **`http://localhost:5274`**.

**What appears:** the single-page dashboard loads. The headline number is pinned:

```
🔒  0 cloud calls    0 API keys    0 bytes off-device
```

The dashboard polls `GET /api/telemetry` live. To prove the counter *moves but
stays at zero*, fire one more ask from the CLI in a split pane:

```bash
npm run cli -- chat --prompt "What is the capital of France?" --mock
```

**Voiceover:**
> "Here's the proof. The dashboard's headline is always **zero cloud calls**. We
> ask Solace one more question — the inference counter ticks up, the cloud-call
> counter **stays pinned at zero**. This isn't a marketing claim; it's a
> machine-checkable telemetry invariant our tests assert."

*(On-screen highlight: the cloud-calls counter staying at `0` while the local
inference counter increments.)*

---

## SEGMENT 7 — Bonus beat: P2P brain upgrade (2:35 – 2:45) *[optional, trim if tight]*

**On screen:**

```bash
npm run cli -- chat --prompt "Summarize this long 40-page report step by step" --mock --peer -v
```

**What appears:** the router elects 🌐 **peer** — delegating the heavy job to a
*bigger on-device model on another device* over QVAC's Holepunch P2P networking.
Still no cloud.

**Voiceover:**
> "And when a task is too heavy for the local brain, Solace **upgrades over P2P** —
> delegating to a peer's bigger on-device model. Still zero cloud. Just another
> device."

---

## SEGMENT 8 — Closing: privacy-first message (2:45 – 3:00)

**On screen:** Cut back to the dashboard, counter still `0`. Title card fades in:

> **Solace — local-first AI that never phones home.**
> Built on Tether QVAC · Apache-2.0 · 100% on-device · `cloudCalls === 0`, always.

**Voiceover:**
> "Solace — sovereign, local-first AI. Every prompt, every document, every secret
> stays on your device, and we can prove it with hard telemetry. Built on Tether's
> QVAC SDK. Your AI. Your device. **Zero cloud calls.**"

**End card:** repo URL · `npm start` · `npm run demo` · `npm test`

---

## 🎬 Shot list / recording checklist

| # | Segment | Window | Command / action | Duration |
|---|---------|--------|------------------|----------|
| 1 | Intro | — | Title card + banner | 25s |
| 2 | Local chat | Terminal | `npm run cli -- chat --prompt "What is 17 multiplied by 23?" --mock -v` | 25s |
| 3 | RAG vault | Terminal | `cd python && .venv/bin/python examples/02_local_rag_vault.py` | 25s |
| 4 | OCR | Terminal | `.venv/bin/python examples/04_ocr.py` | 20s |
| 5 | Translation | Terminal | `.venv/bin/python examples/03_translation.py` | 20s |
| 6 | Dashboard | Browser | `npm start` → `http://localhost:5274` | 40s |
| 7 | P2P (optional) | Terminal | `npm run cli -- chat --prompt "Summarize this long 40-page report step by step" --mock --peer -v` | 10s |
| 8 | Closing | — | End card | 15s |

**Trim plan if over time:** cut Segment 7 (P2P) first — it's optional. Segments
2–6 are the required beats.

**Captions / lower-thirds to prepare:**
- "0 cloud calls · 0 API keys · 0 bytes off-device"
- "Built on Tether QVAC"
- "Apache-2.0 · 100% on-device"
- "EmbeddingsGemma · Llama 3.2 / Qwen3 · local NMT · local OCR"

**One-take alternative:** instead of the segmented run above, just execute
`npm run demo` and narrate over it — it walks through every feature automatically
against the offline engine.
