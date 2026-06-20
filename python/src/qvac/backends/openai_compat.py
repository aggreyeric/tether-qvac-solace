"""OpenAI-compatible backend for the real, on-device QVAC engine.

The QVAC CLI runs a local HTTP server that speaks the OpenAI Chat + Embeddings
API. This backend points the official ``openai`` Python SDK at it
(``base_url=http://127.0.0.1:5273/v1``). Everything stays on your machine —
``is_local`` is always True.

QVAC's translation (NMT) and OCR capabilities are addressed by *model id* over
the same completion API: ``translate`` issues a completion to the NMT model with
a translation instruction, and ``ocr`` issues a multimodal completion carrying
the image as a base64 data URL (the OpenAI vision format QVAC honours).

The ``openai`` package is imported lazily so that code paths that only use the
offline stub never require it.
"""
from __future__ import annotations

import base64
import mimetypes
from typing import Iterator, List

from ..types import CompletionResponse, EmbeddingResponse, Message, Usage
from .base import QvacBackend


class OpenAICompatBackend(QvacBackend):
    """Talks to a local OpenAI-compatible server (the QVAC engine)."""

    def __init__(self, base_url: str, api_key: str, timeout: float = 120.0) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._timeout = timeout
        self._client = None  # lazily constructed

    # ---- lazy client construction ------------------------------------------
    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI  # imported lazily (see module docstring)

            self._client = OpenAI(
                base_url=self._base_url,
                api_key=self._api_key or "qvac-local-no-key-required",
                timeout=self._timeout,
            )
        return self._client

    # ---- chat --------------------------------------------------------------
    def chat(
        self,
        messages: List[Message],
        model: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
        stream: bool = False,
    ) -> CompletionResponse | Iterator[str]:
        payload = {
            "model": model,
            "messages": [m.to_dict() for m in messages],
            "temperature": temperature,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        if stream:
            return self._stream_completion(payload)

        resp = self.client.chat.completions.create(stream=False, **payload)
        choice = resp.choices[0]
        usage = getattr(resp, "usage", None)
        return CompletionResponse(
            text=choice.message.content or "",
            model=getattr(resp, "model", model),
            usage=Usage(
                prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
                completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
            ),
            finish_reason=getattr(choice, "finish_reason", "stop") or "stop",
            local=True,
            engine=self.engine_name,
        )

    def _stream_completion(self, payload: dict) -> Iterator[str]:
        stream = self.client.chat.completions.create(stream=True, **payload)
        for chunk in stream:
            try:
                delta = chunk.choices[0].delta.content
            except (AttributeError, IndexError):
                delta = None
            if delta:
                yield delta

    # ---- embeddings --------------------------------------------------------
    def embed(self, text: str, model: str) -> EmbeddingResponse:
        resp = self.client.embeddings.create(model=model, input=text)
        item = resp.data[0]
        vec = list(item.embedding)
        return EmbeddingResponse(
            embedding=vec,
            model=getattr(resp, "model", model),
            dim=len(vec),
            local=True,
            engine=self.engine_name,
        )

    # ---- translation (local NMT over the completion API) -------------------
    def translate(
        self, text: str, source_lang: str, target_lang: str, model: str
    ) -> str:
        instruction = (
            f"Translate the following text from {source_lang} to {target_lang}. "
            "Output only the translation, nothing else."
        )
        messages = [
            Message(role="system", content=instruction),
            Message(role="user", content=text),
        ]
        resp = self.chat(messages, model=model, temperature=0.2)
        return resp.text.strip()

    # ---- OCR (local OCR over the multimodal completion API) ----------------
    def ocr(self, image_path: str, model: str) -> str:
        data_url = self._image_to_data_url(image_path)
        messages = [
            Message(
                role="user",
                content=(
                    "Extract all visible text from this image (OCR). "
                    "Return only the extracted text, preserving line breaks."
                ),
            ),
            # The second turn carries the image in OpenAI vision format.
            Message(
                role="user",
                content=[
                    {"type": "text", "text": ""},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            ),
        ]
        resp = self.chat(messages, model=model, temperature=0.0)
        return resp.text.strip()

    @staticmethod
    def _image_to_data_url(image_path: str) -> str:
        mime = mimetypes.guess_type(image_path)[0] or "image/png"
        with open(image_path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode("ascii")
        return f"data:{mime};base64,{b64}"

    # ---- health ------------------------------------------------------------
    def healthy(self) -> bool:
        try:
            self.client.models.list()
            return True
        except Exception:
            return False

    # ---- metadata ----------------------------------------------------------
    @property
    def is_local(self) -> bool:
        return True

    @property
    def engine_name(self) -> str:
        return "qvac (local engine)"


__all__ = ["OpenAICompatBackend"]
