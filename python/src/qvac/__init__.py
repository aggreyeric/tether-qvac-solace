"""QVAC Python SDK — local, private AI integration layer for the Tether QVAC SDK.

QVAC (Tether's open-source local-AI SDK) runs LLMs, embeddings, translation,
TTS/STT, OCR and image-gen *on-device*. Its CLI exposes an OpenAI-compatible
HTTP API; this package wraps it in a small, typed Python client with a pluggable
backend so the whole stack (chat, RAG, NMT, OCR) runs and is testable with or
without the native engine installed.

Quick start::

    from qvac import QvacClient
    qvac = QvacClient()                       # auto: real engine, else offline stub
    print(qvac.chat("Hello!").text)
    print(qvac.telemetry.report())            # 0 cloud calls, 0 keys, 0 bytes off-device

Privacy guarantee surfaced by telemetry: data never leaves the device.
"""
from __future__ import annotations

from .client import QvacClient
from .config import QvacConfig
from .rag import LocalRAGVault, RagAnswer, RetrievalHit, Chunk
from .telemetry import PrivacyTelemetry
from .types import (
    ChatMessage,
    CompletionResponse,
    EmbeddingResponse,
    Message,
    Usage,
)
from .translate import TranslationResult, batch_translate
from .ocr import OcrResult, batch_ocr

__version__ = "0.1.0"

__all__ = [
    "QvacClient",
    "QvacConfig",
    "LocalRAGVault",
    "RagAnswer",
    "RetrievalHit",
    "Chunk",
    "PrivacyTelemetry",
    "Message",
    "ChatMessage",
    "Usage",
    "CompletionResponse",
    "EmbeddingResponse",
    "batch_translate",
    "TranslationResult",
    "batch_ocr",
    "OcrResult",
    "__version__",
]
