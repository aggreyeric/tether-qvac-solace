"""Core data types for the QVAC Python SDK.

These mirror the shape of OpenAI-compatible responses (which is the wire format
the QVAC CLI server speaks) so that swapping the offline stub for the real local
engine changes *nothing* upstream.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterator, List, Optional, Union

# A chat turn can be given as a plain ``(role, content)`` tuple, a ``Message``,
# or the canonical OpenAI dict shape ``{"role": ..., "content": ...}``.
ChatMessage = Union["Message", tuple, dict]


@dataclass
class Message:
    """A single chat turn."""

    role: str  # "system" | "user" | "assistant"
    content: str

    def to_dict(self) -> dict:
        return {"role": self.role, "content": self.content}

    @classmethod
    def coerce(cls, msg: ChatMessage) -> "Message":
        if isinstance(msg, Message):
            return msg
        if isinstance(msg, dict):
            return cls(role=msg["role"], content=str(msg.get("content", "")))
        if isinstance(msg, (list, tuple)) and len(msg) == 2:
            return cls(role=msg[0], content=str(msg[1]))
        raise TypeError(f"Cannot coerce {type(msg)!r} into a Message")


@dataclass
class Usage:
    """Approximate token accounting. For a *local* engine these are estimates —
    there is no metered billing, the point is they never leave the device."""

    prompt_tokens: int = 0
    completion_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass
class CompletionResponse:
    """Result of a (non-streaming) completion call."""

    text: str
    model: str
    usage: Usage = field(default_factory=Usage)
    finish_reason: str = "stop"
    local: bool = True  # QVAC is always local; this flag is for telemetry proof
    engine: str = "qvac"
    latency_ms: float = 0.0

    @property
    def content(self) -> str:  # OpenAI-ish alias
        return self.text


@dataclass
class EmbeddingResponse:
    """Result of an embedding call. ``local`` is always True for QVAC."""

    embedding: List[float]
    model: str
    dim: int = 0
    local: bool = True
    engine: str = "qvac"
    latency_ms: float = 0.0

    def __post_init__(self) -> None:
        if not self.dim:
            self.dim = len(self.embedding)


def normalize_messages(messages: Union[str, List[ChatMessage]]) -> List[Message]:
    """Allow ``client.chat("hi")`` as shorthand for a single user turn."""
    if isinstance(messages, str):
        return [Message(role="user", content=messages)]
    return [Message.coerce(m) for m in messages]


__all__ = [
    "Message",
    "ChatMessage",
    "Usage",
    "CompletionResponse",
    "EmbeddingResponse",
    "normalize_messages",
]
