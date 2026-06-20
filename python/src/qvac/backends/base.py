"""Backend interface for the QVAC Python SDK.

A *backend* is the thing that actually performs local inference. There are two
implementations:

* :class:`~qvac.backends.openai_compat.OpenAICompatBackend` — talks to the real
  local QVAC engine (which speaks the OpenAI Chat/Embeddings HTTP API), via the
  official ``openai`` Python SDK.
* :class:`~qvac.backends.stub.LocalStubBackend` — a deterministic, pure-Python
  offline backend. It produces realistically-shaped responses so the *entire*
  pipeline (RAG, translation, OCR, telemetry) runs and is testable on any
  machine without downloading the native engine.

Everything upstream of a backend — the client, the RAG vault, the examples — is
backend-agnostic. Flipping ``QVAC_BACKEND=stub|openai|auto`` is the only switch.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterator, List

from ..types import CompletionResponse, EmbeddingResponse, Message


class QvacBackend(ABC):
    """Abstract local-inference backend."""

    @abstractmethod
    def chat(
        self,
        messages: List[Message],
        model: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        stream: bool = False,
    ) -> CompletionResponse | Iterator[str]:
        """Local chat completion. Returns a :class:`CompletionResponse`, or a
        token iterator when ``stream=True``."""

    @abstractmethod
    def embed(self, text: str, model: str) -> EmbeddingResponse:
        """Local text embedding -> fixed-dim unit vector."""

    @abstractmethod
    def translate(
        self, text: str, source_lang: str, target_lang: str, model: str
    ) -> str:
        """Local neural-machine translation."""

    @abstractmethod
    def ocr(self, image_path: str, model: str) -> str:
        """Local OCR: extract text from an image file."""

    @property
    @abstractmethod
    def is_local(self) -> bool:
        """True when inference stays on this device (QVAC always is)."""

    @property
    @abstractmethod
    def engine_name(self) -> str:
        """Human-readable engine id, e.g. ``"qvac"`` or ``"qvac-stub (offline)"``."""

    # ---- optional health probe used by "auto" backend selection ------------
    def healthy(self) -> bool:
        """Return True if the backend can serve requests *right now*."""
        return True


__all__ = ["QvacBackend"]
