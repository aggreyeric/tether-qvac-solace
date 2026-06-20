"""Tests for the QVAC Python client + on-device RAG vault (offline stub backend).

These run fully offline against the deterministic `stub` backend, so they pass
on any machine — with or without the native QVAC engine installed. They assert
the privacy guarantee that is the whole point of QVAC: zero cloud calls, zero
API keys, zero bytes off-device.
"""
from __future__ import annotations

import pytest

from qvac import QvacClient, QvacConfig
from qvac import batch_translate, batch_ocr
from qvac.types import Message
from qvac.backends.stub import LocalStubBackend


@pytest.fixture()
def qvac() -> QvacClient:
    """A client pinned to the offline deterministic backend."""
    return QvacClient(QvacConfig(backend="stub"))


# --------------------------------------------------------------------------- #
# chat + streaming
# --------------------------------------------------------------------------- #
def test_chat_returns_a_local_completion(qvac: QvacClient) -> None:
    resp = qvac.chat("Explain market regime in one sentence.", temperature=0.2)
    assert resp.text  # non-empty
    assert resp.local is True
    assert resp.usage.total_tokens >= 1


def test_chat_accepts_message_objects(qvac: QvacClient) -> None:
    msgs = [
        Message(role="system", content="Be terse."),
        Message(role="user", content="Hello"),
    ]
    resp = qvac.chat(msgs)
    assert resp.text


def test_stream_yields_tokens(qvac: QvacClient) -> None:
    tokens = list(qvac.stream("Give me three benefits of local AI.", max_tokens=6))
    assert len(tokens) > 0
    assert all(isinstance(t, str) for t in tokens)


def test_embeddings_are_deterministic_and_unit_norm(qvac: QvacClient) -> None:
    a = qvac.embed("bitcoin halving supply")
    b = qvac.embed("bitcoin halving supply")
    assert a.embedding == b.embedding          # deterministic (md5 hashing trick)
    assert a.dim == len(a.embedding)
    norm = sum(v * v for v in a.embedding) ** 0.5
    assert pytest.approx(norm, rel=1e-4) == 1.0  # L2-normalised


# --------------------------------------------------------------------------- #
# local RAG vault — real retrieval over an ingested corpus
# --------------------------------------------------------------------------- #
CORPUS = [
    "Bitcoin has a fixed supply of 21 million coins, created by Satoshi Nakamoto in 2009.",
    "The Bitcoin block reward halves roughly every four years in an event called the halving.",
    "Ethereum moved from proof-of-work to proof-of-stake in the 2022 Merge, cutting energy use ~99.95%.",
    "Stablecoins like USDt track the US dollar and are used as a low-volatility settlement asset.",
]


def test_rag_retrieves_the_relevant_chunk(qvac: QvacClient) -> None:
    vault = qvac.rag(chunk_size=320, chunk_overlap=48)
    for doc in CORPUS:
        vault.add_text(doc, source="knowledge_base")
    assert len(vault) > 0

    hits = vault.search("how often does the block reward halve", k=2)
    assert len(hits) > 0
    assert "halv" in hits[0].chunk.text.lower()
    assert hits[0].score > 0


def test_rag_ask_is_grounded_and_private(qvac: QvacClient) -> None:
    vault = qvac.rag()
    for doc in CORPUS:
        vault.add_text(doc, source="knowledge_base")
    ans = vault.ask("What is Bitcoin's maximum supply?", k=3)
    assert ans.answer
    assert ans.local is True
    assert ans.sources  # grounded in retrieved context


def test_rag_returns_nothing_on_an_empty_vault(qvac: QvacClient) -> None:
    vault = qvac.rag()
    assert vault.search("anything", k=3) == []


# --------------------------------------------------------------------------- #
# translation + OCR batch pipelines
# --------------------------------------------------------------------------- #
def test_translate_runs_locally(qvac: QvacClient) -> None:
    out = qvac.translate("Good morning, the market is open.", target_lang="es", source_lang="en")
    assert "local-stub NMT" in out
    assert "buenos días" in out.lower()


def test_batch_translate_preserves_order(qvac: QvacClient) -> None:
    texts = ["hello", "thank you", "the market"]
    results = batch_translate(qvac, texts, target_lang="fr", source_lang="en")
    assert [r.source_text for r in results] == texts
    assert all(r.target_lang == "fr" for r in results)


def test_batch_ocr_handles_missing_files(qvac: QvacClient) -> None:
    results = batch_ocr(qvac, ["does_not_exist.png"])
    assert len(results) == 1
    assert results[0].ok is False
    assert results[0].text == ""


# --------------------------------------------------------------------------- #
# the privacy guarantee — the core QVAC pitch, made machine-checkable
# --------------------------------------------------------------------------- #
def test_privacy_telemetry_is_all_zero_off_device(qvac: QvacClient) -> None:
    qvac.chat("hi")
    qvac.embed("local first private ai")
    qvac.translate("risk-on regime", target_lang="es")
    snap = qvac.telemetry.snapshot()
    assert snap["cloud_calls"] == 0
    assert snap["api_keys_used"] == 0
    assert snap["bytes_off_device"] == 0
    assert snap["on_device"] is True
    assert snap["local_total"] >= 3


def test_report_is_human_readable(qvac: QvacClient) -> None:
    qvac.chat("hi")
    report = qvac.telemetry.report()
    assert "cloud calls" in report.lower()
    assert "0" in report


def test_client_repr(qvac: QvacClient) -> None:
    r = repr(qvac)
    assert "engine=" in r
    assert qvac.is_local is True


def test_stub_backend_is_marked_offline() -> None:
    assert LocalStubBackend().is_local is True
    assert "offline" in LocalStubBackend().engine_name
