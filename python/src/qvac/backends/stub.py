"""Offline stub backend — deterministic, pure-Python, **no native engine**.

This exists so the entire QVAC pipeline (chat, embeddings, RAG, translation,
OCR, telemetry) runs and is testable on *any* machine, even one where the native
QVAC engine isn't installed. It is **not** a fake: the embeddings are a real
hashing-trick vectorization (deterministic, L2-normalized) so the local RAG
vault does genuine semantic-style retrieval on the provided corpus.

When the real QVAC engine is running locally, set ``QVAC_BACKEND=openai`` (or
``auto``) and the same code paths hit the actual on-device Fabric LLM /
embeddings / NMT / OCR models via :mod:`qvac.backends.openai_compat`.

Responses from this backend are clearly marked as coming from the offline stub.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
from typing import Iterator, List

import numpy as np

from ..types import CompletionResponse, EmbeddingResponse, Message, Usage
from .base import QvacBackend

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_EMBED_DIM = 256


def _tokenize(text: str) -> List[str]:
    """Lowercase alphanumeric tokenizer (shared by chat + embeddings)."""
    return _TOKEN_RE.findall(text.lower())


def _approx_tokens(text: str) -> int:
    """Cheap token estimate (~4 chars/token, same heuristic the OpenAI libs use)."""
    return max(1, len(text) // 4)


class LocalStubBackend(QvacBackend):
    """Deterministic, dependency-free local backend.

    The chat response is rule-based: it acknowledges the request and, when given
    retrieved context (the RAG vault prepends a ``context`` system turn), it
    extracts the most relevant sentence so the end-to-end grounding loop is
    observable. Everything is reproducible — no randomness, no network.
    """

    def __init__(self, embed_dim: int = _EMBED_DIM) -> None:
        self.embed_dim = embed_dim

    # ---- chat --------------------------------------------------------------
    def chat(
        self,
        messages: List[Message],
        model: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        stream: bool = False,
    ) -> CompletionResponse | Iterator[str]:
        prompt_chars = sum(len(m.content) for m in messages)
        answer = self._compose_answer(messages)

        if stream:
            return self._iter_answer(answer, max_tokens)

        return CompletionResponse(
            text=answer,
            model=model,
            usage=Usage(
                prompt_tokens=_approx_tokens(" ".join(m.content for m in messages)),
                completion_tokens=_approx_tokens(answer),
            ),
            finish_reason="stop",
            local=True,
            engine=self.engine_name,
            latency_ms=round(prompt_chars * 0.002, 3),  # deterministic pseudo-cost
        )

    def _compose_answer(self, messages: List[Message]) -> str:
        # The last user message is the actual question.
        user_msg = next((m for m in reversed(messages) if m.role == "user"), None)
        question = user_msg.content.strip() if user_msg else ""

        # A leading system turn carrying RAG context.
        context = "\n".join(
            m.content for m in messages if m.role == "system" and "context" in m.content.lower()[:40]
        )
        context = self._clean_context(context)

        keyword = self._keyword_hint(question)
        if context:
            # Grounded answer: cite the most content-bearing sentence.
            snippet = self._best_sentence(context, keyword)
            return (
                f"[local-stub] Based on the retrieved context: {snippet} "
                f"(answered on-device, no cloud call)."
            )
        return (
            f"[local-stub] On-device response to '{self._short(question)}'. "
            f"Connect the real QVAC engine (QVAC_BACKEND=openai) for full LLM output."
        )

    @staticmethod
    def _clean_context(context: str) -> str:
        """Strip the RAG scaffolding (``retrieved_context:`` header and
        ``[n] (source)`` citation prefixes) so the grounded snippet is clean."""
        lines = []
        for line in context.splitlines():
            line = line.strip()
            if not line or line.lower().startswith("retrieved_context"):
                continue
            # drop a leading "[i] (source)" citation prefix
            line = re.sub(r"^\[\d+\]\s*\([^)]*\)\s*", "", line)
            if line:
                lines.append(line)
        return "\n".join(lines).strip()

    @staticmethod
    def _short(text: str, n: int = 80) -> str:
        text = " ".join(text.split())
        return text if len(text) <= n else text[: n - 1] + "…"

    @staticmethod
    def _keyword_hint(question: str) -> str:
        toks = [t for t in _tokenize(question) if len(t) > 3]
        return toks[-1] if toks else ""

    @staticmethod
    def _best_sentence(context: str, keyword: str) -> str:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", context) if len(s.strip()) > 12]
        if not sentences:
            return context.strip()[:160]
        if keyword:
            ranked = sorted(
                sentences,
                key=lambda s: (keyword.lower() in s.lower(), len(s)),
                reverse=True,
            )
            return ranked[0]
        return max(sentences, key=len)

    def _iter_answer(self, answer: str, max_tokens: int | None) -> Iterator[str]:
        # Stream word-by-word to emulate a streaming local completion.
        budget = None if max_tokens is None else max(1, max_tokens)
        emitted = 0
        for word in answer.split():
            if budget is not None and emitted >= budget:
                break
            yield word + " "
            emitted += 1

    # ---- embeddings (real hashing trick) ----------------------------------
    def embed(self, text: str, model: str) -> EmbeddingResponse:
        vec = np.zeros(self.embed_dim, dtype=np.float32)
        tokens = _tokenize(text)
        for tok in tokens:
            # Deterministic hash (NOT Python's randomized hash()).
            digest = hashlib.md5(tok.encode("utf-8")).digest()
            idx = int.from_bytes(digest[:4], "little") % self.embed_dim
            sign = 1.0 if (digest[4] & 1) == 0 else -1.0
            vec[idx] += sign
        norm = float(np.linalg.norm(vec))
        if norm > 0:
            vec /= norm
        return EmbeddingResponse(
            embedding=vec.tolist(),
            model=model,
            dim=self.embed_dim,
            local=True,
            engine=self.engine_name,
            latency_ms=round(_approx_tokens(text) * 0.001, 3),
        )

    # ---- translation (deterministic phrasebook stand-in) -------------------
    _PHRASEBOOK = {
        ("en", "es"): {"hello": "hola", "good morning": "buenos días",
                        "thank you": "gracias", "the market": "el mercado",
                        "risk": "riesgo", "bitcoin": "bitcoin"},
        ("en", "fr"): {"hello": "bonjour", "good morning": "bonjour",
                        "thank you": "merci", "the market": "le marché",
                        "risk": "risque", "bitcoin": "bitcoin"},
        ("en", "de"): {"hello": "hallo", "thank you": "danke",
                        "the market": "der markt", "risk": "risiko"},
    }

    def translate(self, text: str, source_lang: str, target_lang: str, model: str) -> str:
        sl, tl = source_lang.lower(), target_lang.lower()
        book = self._PHRASEBOOK.get((sl, tl), {})
        if not book:
            return f"[local-stub NMT {sl}->{tl}] {text}  (phrasebook coverage limited offline)"
        out = text
        for src, dst in book.items():
            out = re.sub(rf"\b{re.escape(src)}\b", dst, out, flags=re.IGNORECASE)
        return f"[local-stub NMT {sl}->{tl}] {out}"

    # ---- OCR (deterministic stand-in) --------------------------------------
    def ocr(self, image_path: str, model: str) -> str:
        if image_path and os.path.exists(image_path):
            size = os.path.getsize(image_path)
            return (
                f"[local-stub OCR] processed {os.path.basename(image_path)} "
                f"({size} bytes) on-device. Real QVAC OCR returns extracted text."
            )
        return (
            "[local-stub OCR] no image supplied — real QVAC OCR extracts text "
            "from an image entirely on-device."
        )

    # ---- metadata ----------------------------------------------------------
    @property
    def is_local(self) -> bool:
        return True

    @property
    def engine_name(self) -> str:
        return "qvac-stub (offline)"


__all__ = ["LocalStubBackend"]
