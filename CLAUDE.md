# CLAUDE.md

Guidance for Claude Code working in this repository.

## Overview

**Solace** is a sovereign, local-first AI agent built on the **Tether QVAC SDK** for
the Tether QVAC Hackathon. It runs **100% on-device** — no cloud calls, no API keys —
and can optionally *upgrade its brain over P2P* by delegating heavy inference to a
peer device's larger local model via QVAC's Holepunch networking.

The privacy invariant is hard: telemetry must always report `cloudCalls === 0`. This
is asserted by tests and surfaced live on the dashboard.

The SDK itself is hidden behind a single `QvacClient` seam, so the agent, router,
tools, and telemetry are fully unit-testable against a deterministic offline engine
(`MockQvacClient`) and run identically against the real on-device engine
(`RealQvacClient`, via `--real`).

## Tech Stack

- **Runtime:** Node.js ≥ 22.17 (ESM)
- **Language:** TypeScript (strict, ES2023, `module: NodeNext`)
- **Execution:** `tsx` (no separate compile step needed for dev)
- **Test runner (TS):** Vitest
- **Validation:** `zod`
- **On-device engine:** `@qvac/sdk` (optional dependency, lazy-loaded only with `--real`)
- **HTTP server:** zero-dependency `node:http` (the dashboard)
- **Python SDK:** Python ≥ 3.10, typed client with pluggable backends
  (`stub` ⇄ `openai` real engine), tested with `pytest`
- **Tooling:** npm (root) + a `python/` venv for the SDK
- **Containers:** Docker + docker-compose

## Commands

```bash
npm install                # install deps (@qvac/sdk is optional)

# Run
npm start                  # dashboard on http://localhost:5274 (offline engine)
npm run server             # dashboard server only
npm run dev                # interactive CLI (tsx src/cli.ts)
npm run cli -- chat --prompt "..." --mock -v
npm run agent              # = npm run cli -- chat (interactive REPL)
npm run provider           # become a QVAC P2P compute provider

# Build / typecheck
npm run build              # tsc -p tsconfig.json → dist/
npm run typecheck          # tsc --noEmit (strict)

# Test
npm test                   # Vitest (TS tests)
npm run test:ts            # same, explicit
npm run test:py            # python pytest (needs python/.venv)
npm run test:all           # both TS + Python
npm run test:watch         # Vitest watch mode

# Demo / real engine
npm run demo               # scripts/demo.sh — full offline walkthrough
npm run cli -- chat --real --prompt "..."   # genuine on-device QVAC inference
```

## Architecture — Key Files

```
src/
├── types.ts        # The QvacClient seam + core shared types (THE abstraction)
├── models.ts       # Local model registry (Llama 3.2, Qwen3, EmbeddingGemma…)
├── router.ts       # Local-vs-peer routing brain (pure, fully unit-tested)
├── telemetry.ts    # Zero-cloud audit trail (asserts cloudCalls === 0)
├── tools.ts        # On-device toolkit (calculator, private RAG, translate, time)
├── qvac-mock.ts    # Offline deterministic QVAC client  ← default demo path
├── qvac-real.ts    # Real QVAC SDK adapter               ← loaded only with --real
├── agent.ts        # The routed, tool-using agent loop
├── cli.ts          # `solace chat` / `solace provider` CLI
└── server.ts       # Zero-dependency dashboard (node:http), port 5274

python/
├── src/qvac/       # Typed client + pluggable backends (stub / openai)
└── examples/       # 5 self-contained examples (chat, RAG, NMT, OCR, telemetry)

tests/              # TypeScript tests: router, telemetry, tools, agent, smoke
scripts/demo.sh     # Full offline feature walkthrough
```

**Core design principle:** everything depends on the `QvacClient` interface in
`types.ts`, never on the concrete SDK. When adding features, wire them through a
`QvacClient` method so they stay testable with `MockQvacClient` and work identically
with `RealQvacClient`.

## API Endpoints (Dashboard — port 5274)

The dashboard is served by `src/server.ts` via plain `node:http` (no framework).
Default base URL: `http://localhost:5274`.

| Method | Path              | Description                                                        |
|--------|-------------------|--------------------------------------------------------------------|
| `GET`  | `/`               | The single-page dashboard HTML                                     |
| `GET`  | `/api/telemetry`  | Live zero-cloud telemetry snapshot                                 |
| `GET`  | `/api/models`     | The local model registry                                           |
| `POST` | `/api/ask`        | `{ "prompt": "…" }` → `{ answer, steps, usedPeer, telemetry }`     |

Note the **two distinct local ports**: the TS dashboard is **5274** (`PORT`), while
the QVAC SDK's own local OpenAI-compatible server (used by the Python SDK) is **5273**
(`QVAC_BASE_URL`). Don't confuse them.

## Testing

- **TS suite (Vitest)**: `tests/*.test.ts` — router, telemetry, tools, agent, smoke.
  Run fully offline against the deterministic mock engine. Zero downloads, passes on
  any CI box.
- **Python suite (pytest)**: `python/tests/` — run via
  `cd python && .venv/bin/python -m pytest tests/` (requires the venv).
- The privacy invariant `cloudCalls === 0` is enforced by `tests/telemetry.test.ts`.
  Any change that risks a network call must keep that test green.
- Config: `vitest.config.ts`. TypeScript config: `tsconfig.json` (strict,
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  `noImplicitReturns`).

## Environment Variables

Solace is local-first — **no secrets are required and no cloud keys exist.** The
Python SDK intentionally reads only `os.environ` and does **not** load `.env` files.
See `.env.example` for the optional knobs:

| Variable           | Default                          | Purpose                                                       |
|--------------------|----------------------------------|---------------------------------------------------------------|
| `SOLACE_MODE`      | `mock`                           | `mock` (offline deterministic) vs `real` (on-device QVAC)     |
| `PORT`             | `5274`                           | TS dashboard server port                                      |
| `QVAC_BASE_URL`    | `http://127.0.0.1:5273/v1`       | QVAC's local OpenAI-compat server (Python SDK, `real` mode)   |
| `QVAC_API_KEY`     | `qvac-local-no-key-required`     | Placeholder only — no real key needed                         |
| `QVAC_BACKEND`     | `stub`                           | Python SDK backend: `auto` \| `openai` \| `stub`              |
| `QVAC_MODEL`       | `llama-3.2-1b-instruct`          | Local model id (Python SDK)                                   |
| `QVAC_EMBED_MODEL` | `qvac-embeddings`                | Embedding model id                                            |
| `QVAC_NMT_MODEL`   | `qvac-nmt`                       | Translation model id                                          |
| `QVAC_OCR_MODEL`   | `qvac-ocr`                       | OCR model id                                                  |

## Important Notes

- **`"type": "module"`** — this project is pure ESM. Use `import`/`export` only.
  Imports of local modules **must include the `.js` extension**
  (e.g. `import { foo } from './types.js'`) per NodeNext resolution, even though the
  source files are `.ts`.
- **Use the `.cjs` extension for any CommonJS script** (e.g. a config file that must
  use `require`/`module.exports`, or tooling that doesn't support ESM). Plain `.js`
  files are treated as ESM and will fail if written in CommonJS.
- **`@qvac/sdk` is an `optionalDependency`** and is lazy-loaded only when `--real` is
  passed. The app must start and the full TS test suite must pass with it absent
  (default/offline path). Never `import` it at module top level.
- **Never phone home.** Any new tool or feature must keep the
  `cloudCalls === 0` telemetry invariant. If it touches the network, route it through
  a `QvacClient` method so it's mockable, and update the telemetry assertions.
- **Strict TS** — `noUnusedLocals`/`noUnusedParameters` are on; dead code will fail
  `typecheck` and CI.
- **Python is a sibling, not a subordinate** — keep the `python/` SDK in sync with
  the `QvacClient` seam in `src/types.ts` when interfaces change.
