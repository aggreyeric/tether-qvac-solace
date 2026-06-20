# Hardware Setup & Proof

## Development & Demo Machine

| Component | Spec |
|---|---|
| **Device** | MacBook Pro 18,2 (16") |
| **Chip** | Apple M1 Max |
| **CPU** | 10 cores (8 performance + 2 efficiency) |
| **GPU** | 24-core integrated (Metal 4) |
| **RAM** | 64 GB unified memory |
| **OS** | macOS Darwin 25.3.0 (arm64) |
| **Displays** | Built-in Liquid Retina XDR (3456×2234) + 3 external monitors |
| **Node.js** | v22.x |
| **Python** | 3.10+ |

## Track Compatibility

### General Purpose Track ✅

This machine far exceeds any General Purpose constraints — 64 GB unified memory and 24-core GPU handle QVAC Fabric LLM inference at full speed with room for TurboQuant long-context workloads.

### Mobile / Tinkerer Track ✅

Solace's deterministic offline engine (`qvac-stub`) runs on any device that can run Node.js ≥ 22 — phones, Raspberry Pi, low-end laptops. The `--real` QVAC engine is cross-platform (macOS / Linux / Windows / Android / iOS) per the QVAC SDK spec.

## Performance Characteristics

| Workload | Engine | Time | Notes |
|---|---|---|---|
| Single chat completion (mock) | `qvac-stub` | <50ms | Deterministic, no model download |
| Full demo walkthrough | `qvac-stub` | ~2s | All 6 steps (chat, RAG, NMT, OCR, provider, tests) |
| Single chat completion (real) | `@qvac/sdk` Fabric LLM | ~3-8s | After initial model download (~770 MB for Llama 3.2 1B Q4) |
| P2P delegation (peer) | `qvac-stub` | <50ms | Mock peer; real peer depends on remote hardware |

## Reproducibility

All demos, tests, and benchmarks run against the **offline deterministic engine** by default — zero network, zero model downloads. Any judge on any machine can reproduce identical results with:

```bash
npm install && npm run demo    # or: docker compose up --build
```

For real on-device inference, add `--real` to any CLI command (requires compatible hardware).
