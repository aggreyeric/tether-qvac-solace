#!/usr/bin/env python3
"""Example 3 — local neural-machine translation (NMT) batch pipeline.

Translates a batch of short texts locally with the on-device NMT model. With the
real QVAC engine connected (QVAC_BACKEND=openai) this hits the local NMT model;
offline it uses the bundled deterministic stand-in so the pipeline is runnable
everywhere.

Run:  python examples/03_translation.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from qvac import QvacClient, batch_translate

SENTENCES = [
    "Hello, and thank you for the market risk update.",
    "The market is showing elevated risk today.",
    "Bitcoin is the dominant cryptocurrency.",
]

TARGETS = ["es", "fr", "de"]


def main() -> None:
    qvac = QvacClient()
    print(f"engine: {qvac.engine}\n")

    for target in TARGETS:
        print(f"== English -> {target.upper()} ==")
        results = batch_translate(qvac, SENTENCES, target_lang=target, source_lang="en")
        for r in results:
            print(f"  {r.source_text}\n    -> {r.translated_text}")
        print()

    print(qvac.telemetry.report())


if __name__ == "__main__":
    main()
