# QVAC — Psy / Psyche Model Search

**Date:** 2026-06-21
**Task:** Determine whether Tether QVAC exposes or supports any "Psy" or "Psyche" models.

## TL;DR

**No "Psy" or "Psyche" models found on either page.** The term does not appear in the
documentation body text, the navigation, the API reference, or the model-constant
identifiers on any page I checked.

## Pages Checked

1. **https://qvac.tether.io** — redirects to `https://docs.qvac.tether.io/introduction/`
   (the JS/TS SDK introduction page). The bare `qvac.tether.io` host serves the docs,
   so "both" URLs resolve to the same docs site.
2. **https://docs.qvac.tether.io** — docs landing/home page.
3. (Extra, to be thorough about the full model list)
   - `https://docs.qvac.tether.io/reference/api/` — API reference (85 occurrences of
     the word "model").
   - `https://docs.qvac.tether.io/ai-capabilities/text-generation/` — LLM model list.

## Search Method

For each page I ran an in-browser scan over `document.body.innerText`:

- Word-boundary regex `\b\w*psy\w*\b` (case-insensitive) — **0 matches** on every page.
- Word-boundary regex `\b\w*psyche\w*\b` (case-insensitive) — **0 matches** on every page.
- Counted occurrences of the word `model`.
- Extracted model-constant identifiers (`<NAME>_Q<N>_<N>` pattern) and named model
  families (Llama, Qwen, Mistral, Gemma, DeepSeek, Phi, GPT, Psy, Psyche, ...).

No Psy/Psyche tokens surfaced anywhere.

## What Models QVAC *Does* Support (observed)

From the API reference and text-generation page, the model constants currently
documented are:

| Constant | Family / Capability |
| --- | --- |
| `LLAMA_3_2_1B_INST_Q4_0` | Llama 3.2 — text generation (LLM) |
| `QWEN3_600M_INST_Q4` | Qwen3 600M — text generation (LLM) |
| `QWEN3_1_7B_INST_Q4` | Qwen3 1.7B — text generation (LLM) |
| `PARAKEET_TDT_0_6B_V3_Q8_0` | NVIDIA Parakeet — transcription (ASR) |
| `TTS_T3_TURBO_EN_CHATTERBOX_Q8_0` | Text-to-Speech (English) |
| `TTS_MULTILINGUAL_SUPERTONIC2_Q8_0` | Text-to-Speech (multilingual) |

The SDK does **not** ship models built-in; these constants are just pointers into
QVAC's distributed model registry. The introduction page notes the full index lives
in the registry (see `modelRegistryList()`, `modelRegistrySearch()`,
`modelRegistryGetModel()` in the API reference), and the source index is at
`https://github.com/tetherto/qvac/blob/main/packages/sdk/models/registry/models.ts`.

> Note: I did not fetch the GitHub registry source file (out of scope for "search the
> two pages"). If a Psy/Psyche model exists in the registry but is not yet referenced
> in the docs, that GitHub file is where it would be found.

## Conclusion

No Psy or Psyche models are mentioned on `https://qvac.tether.io` or
`https://docs.qvac.tether.io` as of 2026-06-21. If Tether has announced a "Psy"
model, it is not yet reflected in the published QVAC documentation.
