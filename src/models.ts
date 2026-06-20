/**
 * Solace — model registry.
 *
 * We do NOT statically `import { LLAMA_3_2_1B_INST_Q4_0 } from "@qvac/sdk"` because
 * the SDK may not be installed in environments that only want to run the mock or
 * the test-suite. Instead we keep the *names* here and resolve the real constant
 * lazily inside the real adapter (`qvac-real.ts`).
 *
 * Sizes are approximate weights on disk and used only for routing heuristics and
 * for nice logging.
 */

export interface ModelInfo {
  /** Symbol name as exported by `@qvac/sdk` (e.g. `LLAMA_3_2_1B_INST_Q4_0`). */
  constant: string;
  family: string;
  params: string;
  /** Approx GGUF weight size in MB. */
  approxMb: number;
  /** Supports QVAC native tool-calling. */
  toolCalling: boolean;
  role: "llm" | "embedding";
  blurb: string;
}

export const MODELS = {
  LLAMA_3_2_1B_INST_Q4_0: {
    constant: "LLAMA_3_2_1B_INST_Q4_0",
    family: "Llama 3.2",
    params: "1B",
    approxMb: 770,
    toolCalling: false,
    role: "llm" as const,
    blurb: "Tiny, fast instruct model — the QVAC quickstart default. Great on phones.",
  },
  LLAMA_TOOL_CALLING_1B_INST_Q4_K: {
    constant: "LLAMA_TOOL_CALLING_1B_INST_Q4_K",
    family: "Llama 3.2 (tool-calling fine-tune)",
    params: "1B",
    approxMb: 815,
    toolCalling: true,
    role: "llm" as const,
    blurb: "Llama 3.2 1B fine-tuned for native function-calling. The agent's default brain.",
  },
  QWEN3_4B_Q4_K_M: {
    constant: "QWEN3_4B_Q4_K_M",
    family: "Qwen3",
    params: "4B",
    approxMb: 2500,
    toolCalling: true,
    role: "llm" as const,
    blurb: "A bigger brain — what a peer provider typically advertises for delegation.",
  },
  EMBEDDINGGEMMA_300M_Q4_0: {
    constant: "EMBEDDINGGEMMA_300M_Q4_0",
    family: "EmbeddingGemma",
    params: "300M",
    approxMb: 200,
    toolCalling: false,
    role: "embedding" as const,
    blurb: "Embeddings for private on-device RAG. Tiny and fast.",
  },
} satisfies Record<string, ModelInfo>;

export type ModelKey = keyof typeof MODELS;

/** Sensible defaults. */
export const DEFAULT_LLM: ModelKey = "LLAMA_TOOL_CALLING_1B_INST_Q4_K";
export const DEFAULT_SMALL_LLM: ModelKey = "LLAMA_3_2_1B_INST_Q4_0";
export const DEFAULT_PEER_LLM: ModelKey = "QWEN3_4B_Q4_K_M";
export const DEFAULT_EMBEDDING: ModelKey = "EMBEDDINGGEMMA_300M_Q4_0";

export function describeModel(key: ModelKey): string {
  const m = MODELS[key];
  return `${m.family} (${m.params}) — ${m.blurb}`;
}
