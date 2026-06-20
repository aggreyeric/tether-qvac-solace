"""Local RAG vault — fully on-device retrieval-augmented generation.

Pipeline: chunk a corpus -> embed every chunk locally -> at query time embed the
question, rank chunks by cosine similarity, prepend the top-k as context, and
answer with a local completion. No cloud, no API keys, embeddings never leave
the device.

The retrieval math (chunking, cosine ranking) is real and backend-agnostic; only
the embedding/completion *source* differs (offline stub vs. the real QVAC
engine). That means the vault behaves identically whether or not the native
engine is installed — which is exactly what makes it testable and demoable
everywhere.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

from .types import Message


@dataclass
class Chunk:
    text: str
    source: str
    index: int


@dataclass
class RetrievalHit:
    chunk: Chunk
    score: float


@dataclass
class RagAnswer:
    answer: str
    sources: List[RetrievalHit] = field(default_factory=list)
    local: bool = True


class LocalRAGVault:
    """A tiny, dependency-light on-device RAG store."""

    def __init__(self, client, chunk_size: int = 480, chunk_overlap: int = 64) -> None:
        self.client = client
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self._chunks: List[Chunk] = []
        self._vectors: Optional[np.ndarray] = None  # (n, d) unit-normalized rows

    # ---- ingestion ---------------------------------------------------------
    def add_text(self, text: str, source: str = "input") -> "LocalRAGVault":
        for i, piece in enumerate(self._chunk(text)):
            self._chunks.append(Chunk(text=piece, source=source, index=i))
        self._rebuild_index()
        return self

    def add_file(self, path: str, encoding: str = "utf-8") -> "LocalRAGVault":
        with open(path, "r", encoding=encoding) as fh:
            return self.add_text(fh.read(), source=path)

    def add_documents(self, docs: List[Tuple[str, str]]) -> "LocalRAGVault":
        """``docs`` is a list of ``(text, source)`` pairs."""
        for text, source in docs:
            self.add_text(text, source=source)
        return self

    def _rebuild_index(self) -> None:
        if not self._chunks:
            self._vectors = None
            return
        rows = [
            np.asarray(self.client.embed(c.text).embedding, dtype=np.float32)
            for c in self._chunks
        ]
        mat = np.vstack(rows).astype(np.float32)
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        self._vectors = mat / norms

    # ---- chunking ----------------------------------------------------------
    def _chunk(self, text: str) -> List[str]:
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            return []
        # Sentence-aware splitting, then greedy packing into ~chunk_size windows.
        sentences = re.split(r"(?<=[.!?])\s+", text)
        pieces: List[str] = []
        buf = ""
        for sent in sentences:
            candidate = (buf + " " + sent).strip() if buf else sent
            if len(candidate) <= self.chunk_size:
                buf = candidate
            else:
                if buf:
                    pieces.append(buf)
                # Long sentence on its own; otherwise start a new buffer.
                if len(sent) <= self.chunk_size:
                    buf = sent
                else:
                    pieces.extend(self._hard_split(sent))
                    buf = ""
        if buf:
            pieces.append(buf)
        # Add overlap between consecutive pieces for cross-boundary recall.
        if self.chunk_overlap > 0 and len(pieces) > 1:
            pieces = self._with_overlap(pieces)
        return pieces

    def _hard_split(self, text: str) -> List[str]:
        return [text[i : i + self.chunk_size] for i in range(0, len(text), self.chunk_size)]

    def _with_overlap(self, pieces: List[str]) -> List[str]:
        out = [pieces[0]]
        for prev, cur in zip(pieces, pieces[1:]):
            tail = prev[-self.chunk_overlap :] if len(prev) >= self.chunk_overlap else prev
            out.append((tail + " " + cur).strip())
        return out

    # ---- retrieval ---------------------------------------------------------
    def search(self, query: str, k: int = 4) -> List[RetrievalHit]:
        if self._vectors is None or not self._chunks:
            return []
        q = np.asarray(self.client.embed(query).embedding, dtype=np.float32)
        qn = np.linalg.norm(q)
        if qn == 0:
            return []
        q = q / qn
        scores = self._vectors @ q  # cosine sim (rows are unit-norm)
        k = min(k, len(self._chunks))
        # Top-k indices, descending.
        idx = np.argpartition(-scores, k - 1)[:k]
        idx = idx[np.argsort(-scores[idx])]
        return [RetrievalHit(chunk=self._chunks[i], score=float(scores[i])) for i in idx]

    # ---- generation --------------------------------------------------------
    def ask(self, query: str, k: int = 4, system: Optional[str] = None) -> RagAnswer:
        hits = self.search(query, k=k)
        context = "\n".join(f"[{i}] ({h.chunk.source}) {h.chunk.text}" for i, h in enumerate(hits))
        sys = system or (
            "You are a private, on-device assistant. Answer the user's question using "
            "ONLY the retrieved local context below. If the context is insufficient, "
            "say so. Never reveal that you are running on any particular engine."
        )
        messages = [
            Message(role="system", content=f"retrieved_context:\n{context}" if context else "(no context)"),
            Message(role="system", content=sys),
            Message(role="user", content=query),
        ]
        resp = self.client.chat(messages)
        return RagAnswer(answer=resp.text, sources=hits, local=resp.local)

    # ---- introspection -----------------------------------------------------
    def __len__(self) -> int:
        return len(self._chunks)

    @property
    def chunks(self) -> List[Chunk]:
        return list(self._chunks)


__all__ = ["LocalRAGVault", "Chunk", "RetrievalHit", "RagAnswer"]
