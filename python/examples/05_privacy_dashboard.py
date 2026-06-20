#!/usr/bin/env python3
"""Example 5 — the privacy dashboard: proof that AI ran locally.

Runs a mixed workload (chat + embeddings + translation) and then exports the
privacy telemetry as both a console report and a PNG chart. The chart and
report make the QVAC guarantee explicit: 0 cloud calls, 0 API keys used,
0 bytes sent off-device.

Run:  python examples/05_privacy_dashboard.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from qvac import QvacClient


def main() -> None:
    qvac = QvacClient()
    print(f"engine: {qvac.engine}\n")

    # A small mixed on-device workload.
    qvac.chat("Summarize the case for local AI in two sentences.")
    qvac.embed("local first private ai embeddings")
    qvac.embed("tether qvac on device inference")
    qvac.translate("Good morning, the risk regime is risk-on.", target_lang="es")

    out_dir = Path(__file__).resolve().parent.parent / "results"
    chart = qvac.telemetry.save_chart(str(out_dir / "privacy_dashboard.png"))

    print(qvac.telemetry.report())
    print(f"\n📊 chart saved: {chart}")
    print(
        "\nTakeaway: a real AI workload ran with ZERO data leaving the device — "
        "the core QVAC promise, made visible."
    )


if __name__ == "__main__":
    main()
