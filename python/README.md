# QVAC Python SDK — local, private AI client

A small, typed Python client over the [Tether QVAC](https://qvac.tether.io) engine.
QVAC runs LLMs, embeddings, RAG, NMT translation and OCR **on-device**; its CLI
exposes an OpenAI-compatible HTTP API. This package wraps it with a pluggable
backend so the **whole stack runs and is testable with or without the native
engine installed**.

## Install (editable, from the repo)

```bash
cd python
python3 -m venv .venv
.venv/bin/pip install -e .[dev]
```

## Quick start

```python
from qvac import QvacClient

qvac = QvacClient()                         # auto: real engine if running, else offline stub
print(qvac.chat("Summarize Bitcoin in one sentence.").text)

vault = qvac.rag()
vault.add_text("Bitcoin has a fixed supply of 21 million coins.")
print(vault.ask("What is Bitcoin's supply?").answer)

print(qvac.telemetry.report())             # 0 cloud calls · 0 API keys · 0 bytes off-device
```

## Backends (`QVAC_BACKEND=auto|openai|stub`)

| backend | when |
|---|---|
| `stub` (default-safe) | offline, deterministic, **no native engine** — real hashing-trick embeddings + cosine RAG |
| `openai` | the real local QVAC engine (OpenAI-compatible API at `QVAC_BASE_URL`) |
| `auto` | probes the local engine; uses it if reachable, else the offline stub |

## Examples

```bash
.venv/bin/python examples/01_local_chat.py        # chat + streaming + telemetry
.venv/bin/python examples/02_local_rag_vault.py   # flagship: private on-device RAG
.venv/bin/python examples/03_translation.py       # batch NMT
.venv/bin/python examples/04_ocr.py               # local OCR
.venv/bin/python examples/05_privacy_dashboard.py # telemetry chart export
```

## Test

```bash
.venv/bin/python -m pytest tests/    # 14 tests, fully offline
```

License: Apache-2.0.
