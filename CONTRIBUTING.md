# Contributing to Solace (tether-qvac)

🎉 **Thanks for your interest in contributing to Solace!**
Solace is a sovereign, local-first AI agent built on the Tether QVAC SDK. Its
north star is simple: **`cloudCalls === 0`, always.** Every contribution should
keep that promise intact. We welcome bug reports, features, docs, tests, and
privacy-proving telemetry improvements.

---

## 📖 Read the README first!

Seriously — **read [`README.md`](README.md) before anything else.** It covers the
architecture, the `QvacClient` seam, the local-vs-peer router, and the zero-cloud
telemetry model. Understanding *why* the SDK sits behind a single interface (so the
whole agent is unit-testable against a deterministic offline engine) will save you a
lot of time. The [Project structure](README.md#-project-structure) section is the
map for the codebase.

---

## ✅ Prerequisites

- **Node.js ≥ 22.17** and npm
- **Python ≥ 3.10** (only if you're touching the Python SDK in `python/`)

---

## 🛠️ Setup

```bash
npm install
npm start            # → http://localhost:5274  (offline engine, zero downloads)
```

That's it — the default engine is the **offline deterministic mock**, so there are
no model downloads and no network. You can explore the dashboard and ask Solace a
question immediately.

If you need the real on-device engine (downloads a model on first run):

```bash
npm run cli -- chat --real --prompt "Explain quantum computing in one sentence."
```

For the Python SDK:

```bash
cd python
python3 -m venv .venv && .venv/bin/pip install -e .[dev]
.venv/bin/python examples/01_local_chat.py
```

---

## 🧪 Running tests

The full suite runs **offline** against deterministic engines — no downloads, no
network, identical results on any machine. Please make sure all of these are green
before opening a PR:

```bash
npm run typecheck     # strict tsc --noEmit
npm test              # TypeScript tests (router, telemetry, tools, agent)
npm run test:py       # Python tests (client, RAG, telemetry, NMT, OCR)
npm run test:all      # both
```

For a full feature walkthrough (agent + tools + routing + provider + Python SDK +
tests):

```bash
npm run demo
```

### Writing tests

- New logic should be testable against the **deterministic offline engine**
  (`MockQvacClient`). The whole point of the `QvacClient` seam is that the agent,
  router, tools, and telemetry stay fully unit-testable without the real SDK.
- If you add a tool, add a test in `tests/`.
- Any change that could affect privacy must keep `cloudCalls === 0` asserted by the
  telemetry tests.

---

## 🧹 Code style

- **TypeScript:** strict mode is on (`npm run typecheck` must pass). Prefer types
  over `any`. Keep the `QvacClient` interface pure so nothing leaks SDK details
  into the agent layer.
- **Python:** follow the existing typed client style in `python/src/qvac/`. The SDK
  reads only `os.environ` and deliberately does **not** load `.env` files — keep it
  that way.
- **Keep the zero-cloud invariant:** no code path may make a network/cloud call
  unless it's the explicitly opt-in `--real` path. Telemetry is the proof — never
  bypass it.
- Small, focused commits with clear messages.

---

## 🔄 Pull requests & issues

1. **Open an issue first** for new features or large changes, so we can align on
   approach before you write a lot of code.
2. **Fork & branch** from `main`. Use a descriptive branch name
   (e.g. `feat/peer-routing-telemetry`).
3. **Write tests** for your change and ensure the full suite passes:
   ```bash
   npm run test:all
   ```
4. **Keep PRs focused** — one logical change per PR makes review faster.
5. **Describe the "why"** in your PR description: what problem it solves, how it
   preserves the zero-cloud invariant, and how you tested it.
6. Reference the related issue (e.g. `Closes #42`).

### Reporting bugs

When filing an issue, include:
- What you did (exact commands)
- What you expected
- What actually happened (logs, telemetry output)
- Your environment (Node/Python versions, OS, whether you used `--mock` or `--real`)

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the
**Apache-2.0** license (the same license as the QVAC SDK). See [`LICENSE`](LICENSE)
for details.

---

_Solace — local-first AI that never phones home._
