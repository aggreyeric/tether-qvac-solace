# Demo Logs

This directory contains exported artifacts from Solace demo runs for judge review.

## Files

| File | Description | Command used |
|---|---|---|
| `sample-run.log` | Full `npm run demo` output — all 6 steps: chat, RAG, NMT, OCR, P2P provider, tests + privacy telemetry | `npm run demo 2>&1 | tee logs/sample-run.log` |

## How to regenerate

```bash
npm run demo 2>&1 | tee logs/sample-run.log
```

Every run produces identical output against the offline deterministic engine (no randomness, no network).
