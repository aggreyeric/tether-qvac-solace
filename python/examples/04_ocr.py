#!/usr/bin/env python3
"""Example 4 — local OCR: extract text from an image, on-device.

Generates a small sample image (using matplotlib, headless), runs the local OCR
pipeline over it, and prints the extracted text. With the real QVAC engine
(QVAC_BACKEND=openai) this uses the on-device OCR model; offline it uses the
bundled stand-in so the pipeline is fully runnable.

Run:  python examples/04_ocr.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from qvac import QvacClient


def make_sample_image(path: str) -> str:
    """Render a simple text-bearing PNG so the example is self-contained."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(5, 2))
    ax.axis("off")
    ax.text(
        0.5,
        0.5,
        "LOCAL OCR DEMO\nTether QVAC\n0 cloud calls",
        ha="center",
        va="center",
        fontsize=20,
        family="monospace",
    )
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)
    return path


def main() -> None:
    qvac = QvacClient()
    print(f"engine: {qvac.engine}\n")

    img = make_sample_image(str(Path(__file__).resolve().parent.parent / "data" / "ocr_sample.png"))
    print(f"sample image written: {img} ({os.path.getsize(img)} bytes)")

    text = qvac.ocr(img)
    print("OCR result:", text)
    print()
    print(qvac.telemetry.report())


if __name__ == "__main__":
    main()
