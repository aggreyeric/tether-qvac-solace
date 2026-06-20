"""Batch translation pipeline — local NMT over many texts.

A thin convenience layer over :meth:`qvac.QvacClient.translate` that handles
lists, records telemetry, and returns structured results. Useful for the
"translate these 40 document chunks locally" use case.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

from .client import QvacClient


@dataclass
class TranslationResult:
    source_text: str
    translated_text: str
    source_lang: str
    target_lang: str


def batch_translate(
    client: QvacClient,
    texts: List[str],
    target_lang: str,
    source_lang: str = "auto",
) -> List[TranslationResult]:
    """Translate a list of texts locally, one NMT call each."""
    out: List[TranslationResult] = []
    for t in texts:
        translated = client.translate(t, target_lang=target_lang, source_lang=source_lang)
        out.append(
            TranslationResult(
                source_text=t,
                translated_text=translated,
                source_lang=source_lang,
                target_lang=target_lang,
            )
        )
    return out


__all__ = ["batch_translate", "TranslationResult"]
