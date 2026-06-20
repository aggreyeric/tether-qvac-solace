"""Batch OCR pipeline — extract text from many images locally.

A thin convenience layer over :meth:`qvac.QvacClient.ocr` that processes a list
of image paths on-device and returns structured results.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List

from .client import QvacClient


@dataclass
class OcrResult:
    image_path: str
    text: str
    ok: bool


def batch_ocr(client: QvacClient, image_paths: List[str]) -> List[OcrResult]:
    """Run local OCR over a list of image files."""
    out: List[OcrResult] = []
    for path in image_paths:
        if not os.path.exists(path):
            out.append(OcrResult(image_path=path, text="", ok=False))
            continue
        text = client.ocr(path)
        out.append(OcrResult(image_path=path, text=text, ok=True))
    return out


__all__ = ["batch_ocr", "OcrResult"]
