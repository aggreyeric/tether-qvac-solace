"""The QVAC Python client — one entry point for local, private AI.

    >>> from qvac import QvacClient
    >>> qvac = QvacClient()                 # auto-selects real engine, else offline stub
    >>> resp = qvac.chat("Summarize Bitcoin in one sentence.")
    >>> print(resp.text)
    >>> vault = qvac.rag()
    >>> vault.add_text("Bitcoin has a fixed supply of 21 million coins.")
    >>> vault.ask("What is Bitcoin's supply?").answer

Everything runs on-device. ``qvac.telemetry.report()`` prints the proof that
nothing left the machine (0 cloud calls, 0 API keys, 0 bytes off-device).
"""
from __future__ import annotations

from typing import Iterator, List, Optional, Union

from .backends import build_backend
from .config import QvacConfig
from .rag import LocalRAGVault
from .telemetry import PrivacyTelemetry
from .types import (
    ChatMessage,
    CompletionResponse,
    EmbeddingResponse,
    Message,
    normalize_messages,
)


class QvacClient:
    """High-level client over a local QVAC backend."""

    def __init__(
        self,
        config: Optional[QvacConfig] = None,
        *,
        backend: Optional[str] = None,
    ) -> None:
        self.config = config or QvacConfig.from_env()
        if backend:  # explicit override beats config
            self.config.backend = backend
        self.backend = build_backend(self.config)
        self.telemetry = PrivacyTelemetry(engine=self.backend.engine_name)

    # ---- chat --------------------------------------------------------------
    def chat(
        self,
        messages: Union[str, List[ChatMessage]],
        *,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
    ) -> CompletionResponse:
        msgs = normalize_messages(messages)
        resp = self.backend.chat(
            msgs,
            model=model or self.config.llm_model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        self.telemetry.record("completion")
        return resp

    def stream(
        self,
        messages: Union[str, List[ChatMessage]],
        *,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
    ) -> Iterator[str]:
        """Yield completion tokens as they are produced on-device."""
        msgs = normalize_messages(messages)
        stream = self.backend.chat(
            msgs,
            model=model or self.config.llm_model,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        # backends return an iterator[str] when stream=True
        for tok in stream:  # type: ignore[union-attr]
            yield tok
        self.telemetry.record("completion")

    # ---- embeddings --------------------------------------------------------
    def embed(self, text: str, *, model: Optional[str] = None) -> EmbeddingResponse:
        resp = self.backend.embed(text, model=model or self.config.embed_model)
        self.telemetry.record("embedding")
        return resp

    # ---- translation (local NMT) ------------------------------------------
    def translate(
        self,
        text: str,
        target_lang: str,
        source_lang: str = "auto",
        *,
        model: Optional[str] = None,
    ) -> str:
        out = self.backend.translate(
            text, source_lang, target_lang, model=model or self.config.nmt_model
        )
        self.telemetry.record("translation")
        return out

    # ---- OCR ---------------------------------------------------------------
    def ocr(self, image_path: str, *, model: Optional[str] = None) -> str:
        out = self.backend.ocr(image_path, model=model or self.config.ocr_model)
        self.telemetry.record("ocr")
        return out

    # ---- RAG ---------------------------------------------------------------
    def rag(
        self,
        *,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> LocalRAGVault:
        """Create an empty on-device RAG vault bound to this client."""
        return LocalRAGVault(
            self,
            chunk_size=chunk_size or self.config.chunk_size,
            chunk_overlap=chunk_overlap or self.config.chunk_overlap,
        )

    # ---- introspection -----------------------------------------------------
    @property
    def engine(self) -> str:
        return self.backend.engine_name

    @property
    def is_local(self) -> bool:
        return self.backend.is_local

    def __repr__(self) -> str:
        return f"<QvacClient engine={self.engine!r} local={self.is_local}>"


__all__ = ["QvacClient"]
