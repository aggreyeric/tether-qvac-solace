"""Backend implementations + factory for auto-selection."""
from __future__ import annotations

from ..config import QvacConfig
from .base import QvacBackend
from .openai_compat import OpenAICompatBackend
from .stub import LocalStubBackend


def build_backend(config: QvacConfig) -> QvacBackend:
    """Construct the backend requested by ``config.backend``.

    Selection rules:
      * ``"stub"``   -> always the offline deterministic backend.
      * ``"openai"`` -> always the real local-engine backend.
      * ``"auto"``   -> real engine if it answers a health probe within
        ``probe_timeout`` seconds, otherwise the offline stub (so everything
        keeps working on machines without the native engine installed).
    """
    choice = (config.backend or "auto").lower()

    if choice == "stub":
        return LocalStubBackend()

    if choice == "openai":
        return OpenAICompatBackend(config.base_url, config.api_key, config.request_timeout)

    # auto
    real = OpenAICompatBackend(config.base_url, config.api_key, config.request_timeout)
    # Short-circuit: if the engine isn't reachable, fall back to the stub so the
    # SDK is usable everywhere. We bound the probe so import-time never hangs.
    if _probe(real, config.probe_timeout):
        return real
    return LocalStubBackend()


def _probe(backend: OpenAICompatBackend, timeout: float) -> bool:
    """Best-effort reachability check; never raises."""
    # Temporarily cap the OpenAI client timeout for the probe.
    backend._timeout = timeout  # noqa: SLF001 - intentional internal config
    try:
        return backend.healthy()
    except Exception:
        return False


__all__ = ["QvacBackend", "OpenAICompatBackend", "LocalStubBackend", "build_backend"]
