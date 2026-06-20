#!/usr/bin/env python3
"""Example 2 — the flagship: a fully private, on-device RAG vault.

Ingest a small corpus of crypto docs, then ask questions that are answered
*only* from the locally-embedded, locally-retrieved context. Embeddings and the
answer never leave the device — the privacy telemetry proves it.

This maps directly to the "Private Local RAG Vault" QVAC use case.

Run:  python examples/02_local_rag_vault.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from qvac import QvacClient

# A tiny private knowledge base. In a real app you'd point add_file() at PDFs /
# notes / chat exports — none of which ever get uploaded.
CORPUS = [
    ("Bitcoin has a fixed supply of 21 million coins and was created by Satoshi "
     "Nakamoto in 2009. New bitcoins are issued to miners as a block reward, which "
     "halves roughly every four years in an event called the halving."),
    ("Ethereum is a programmable blockchain that introduced smart contracts. It uses "
     "gas fees to price computation and transitioned from proof-of-work to proof-of-stake "
     "in the 2022 Merge, cutting its energy use by ~99.95%."),
    ("The Fear & Greed Index aggregates sentiment, volatility, momentum and social "
     "signals into a single 0-100 score. Values below 25 signal Extreme Fear; above 75 "
     "signal Extreme Greed."),
    ("Stablecoins like USDt aim to track the US dollar. They are widely used as a "
     "low-volatility settlement asset in crypto markets and increasingly for real-world "
     "payments and remittances."),
]


def main() -> None:
    qvac = QvacClient()
    vault = qvac.rag(chunk_size=320, chunk_overlap=48)
    for text in CORPUS:
        vault.add_text(text, source="knowledge_base")
    print(f"engine: {qvac.engine} | vault chunks: {len(vault)}\n")

    questions = [
        "How often does the Bitcoin block reward halve?",
        "What does the Fear and Greed Index measure?",
        "Why did Ethereum's energy use drop so much?",
    ]
    for q in questions:
        ans = vault.ask(q, k=3)
        top = ans.sources[0] if ans.sources else None
        score = f"{top.score:.2f}" if top else "n/a"
        src = (top.chunk.text[:55] + "…") if top else "n/a"
        print(f"Q: {q}")
        print(f"A: {ans.answer}")
        print(f"   (top chunk score={score}: {src})\n")

    print(qvac.telemetry.report())


if __name__ == "__main__":
    main()
