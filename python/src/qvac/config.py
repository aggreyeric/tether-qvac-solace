"""Configuration for the QVAC Python client.

QVAC runs *locally* and exposes an OpenAI-compatible HTTP API from its CLI
(``qvac`` / ``qvac-server``). This config tells the client where that server is
and which local model ids to address.

Design choices worth stating explicitly:

* **No secrets are read from disk.** We only read ``os.environ``. We deliberately
  do **not** load ``.env`` files (per project rules). If you want to point at a
  different local engine, export the env var in your shell.
* **``backend="auto"``** tries the OpenAI-compatible local server first and
  transparently falls back to the bundled offline ``stub`` backend, so examples
  and tests run on any machine — with or without the native QVAC engine
  installed. When the real engine is up, ``auto`` uses it.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

# Default local QVAC server endpoint. Override with ``QVAC_BASE_URL``.
DEFAULT_BASE_URL = os.environ.get("QVAC_BASE_URL", "http://127.0.0.1:5273/v1")
# QVAC's local server typically needs no real key; we send a placeholder only
# because the OpenAI client requires *something* non-empty.
DEFAULT_API_KEY = os.environ.get("QVAC_API_KEY", "qvac-local-no-key-required")

# Default local model ids. The QVAC quickstart uses Llama 3.2 1B Instruct.
DEFAULT_LLM_MODEL = os.environ.get("QVAC_MODEL", "llama-3.2-1b-instruct")
DEFAULT_EMBED_MODEL = os.environ.get("QVAC_EMBED_MODEL", "qvac-embeddings")
DEFAULT_NMT_MODEL = os.environ.get("QVAC_NMT_MODEL", "qvac-nmt")
DEFAULT_OCR_MODEL = os.environ.get("QVAC_OCR_MODEL", "qvac-ocr")


@dataclass
class QvacConfig:
    """Connection + model configuration for :class:`~qvac.client.QvacClient`."""

    base_url: str = DEFAULT_BASE_URL
    api_key: str = DEFAULT_API_KEY
    # "auto" | "openai" | "stub"
    backend: str = "auto"
    # Seconds to wait when probing a local server in "auto" mode.
    probe_timeout: float = 0.75

    llm_model: str = DEFAULT_LLM_MODEL
    embed_model: str = DEFAULT_EMBED_MODEL
    nmt_model: str = DEFAULT_NMT_MODEL
    ocr_model: str = DEFAULT_OCR_MODEL

    # Local RAG defaults.
    chunk_size: int = 480
    chunk_overlap: int = 64

    request_timeout: float = 120.0
    extra: dict = field(default_factory=dict)

    @classmethod
    def from_env(cls) -> "QvacConfig":
        """Build a config purely from environment variables (no file reads)."""
        return cls(
            base_url=DEFAULT_BASE_URL,
            api_key=DEFAULT_API_KEY,
            backend=os.environ.get("QVAC_BACKEND", "auto"),
            llm_model=DEFAULT_LLM_MODEL,
            embed_model=DEFAULT_EMBED_MODEL,
            nmt_model=DEFAULT_NMT_MODEL,
            ocr_model=DEFAULT_OCR_MODEL,
        )


__all__ = ["QvacConfig", "DEFAULT_BASE_URL"]
