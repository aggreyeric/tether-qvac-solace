#!/usr/bin/env python3
"""Example 1 — basic on-device chat completion + streaming.

Shows the simplest QVAC interaction: ask a local model a question, get an
answer that never left your machine, then stream a second response token by
token. Finishes by printing the privacy telemetry.

Run:  python examples/01_local_chat.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make `import qvac` work when running from the repo without installing.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from qvac import QvacClient


def main() -> None:
    qvac = QvacClient()  # auto: real local engine if running, else offline stub
    print(f"engine: {qvac.engine}  (local={qvac.is_local})\n")

    # 1) One-shot completion.
    resp = qvac.chat(
        "You are a concise crypto analyst. Explain market regime in one sentence.",
        temperature=0.3,
    )
    print("answer:", resp.text)
    print(f"({resp.usage.total_tokens} tokens, engine={resp.engine})\n")

    # 2) Streaming completion (tokens arrive as they are produced on-device).
    print("streamed answer:")
    for token in qvac.stream("Give me three benefits of running AI locally."):
        print(token, end="", flush=True)
    print("\n")

    # 3) The proof nothing left the device.
    print(qvac.telemetry.report())


if __name__ == "__main__":
    main()
