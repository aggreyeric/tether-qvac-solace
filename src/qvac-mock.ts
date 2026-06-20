/**
 * Solace — the deterministic, offline {@link QvacClient} ("mock" engine).
 *
 * This is what makes Solace demoable and fully unit-testable *instantly*, with
 * zero model downloads and zero network. It is deliberately **not a no-op**:
 *
 *   - `completion` emulates the agent's tool-calling loop by intent-matching the
 *     prompt against the supplied tools, so the full plan → route → tool-call →
 *     answer cycle is observable offline and reproducibly seedable.
 *   - `ragIngest` / `ragSearch` do *real* retrieval: documents are tokenized into
 *     term-frequency vectors and ranked by cosine similarity, so the private
 *     knowledge-base behaves like a genuine local RAG store.
 *   - `startProvider` / `stopProvider` simulate becoming a QVAC compute provider
 *     on the P2P network (returns a deterministic public key), which lets the
 *     routing brain demonstrate peer delegation in a one-process demo.
 *
 * Swap in {@link ./qvac-real.ts} (`--real`) to route these same calls through the
 * actual on-device QVAC engine — nothing else in Solace changes.
 *
 * (c) 2026 — built for the Tether QVAC Hackathon. Apache-2.0.
 */

import type {
  ChatMessage,
  CompletionOptions,
  CompletionResult,
  CompletionStats,
  LoadModelOptions,
  QvacClient,
} from "./types.js";
import { telemetry } from "./telemetry.js";

/* ------------------------------------------------------------------ *
 * Deterministic RNG (mulberry32) — so a given `seed` reproduces a run.
 * ------------------------------------------------------------------ */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockQvacOptions {
  /** Seed for deterministic (reproducible) runs. Default: 1. */
  seed?: number;
  /** Default RAG workspace name. */
  workspace?: string;
  /**
   * Simulate a peer provider being reachable, so the router can elect to
   * delegate. (In the real app this flips true once P2P discovery connects.)
   */
  peerConnected?: boolean;
}

interface LoadedMockModel {
  modelId: string;
  modelKey: string;
  role: "llm" | "embedding";
  toolCalling: boolean;
}

/* ------------------------------------------------------------------ *
 * Intent → tool selection. Mirrors how the real tool-calling fine-tune
 * decides which local function to invoke. Kept as pure regex heuristics so
 * the agent loop is fully testable offline.
 * ------------------------------------------------------------------ */
interface ToolIntent {
  name: string;
  args: Record<string, unknown>;
}

function firstUserText(history: ChatMessage[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") return history[i].content;
  }
  return "";
}

/**
 * Pull a symbolic arithmetic expression out of a prompt, normalising word
 * operators ("multiplied by", "times", "plus", "minus", "divided by", "mod")
 * so the calculator tool can be driven from natural language. Returns the
 * cleaned expression or null when no real arithmetic is present.
 */
function extractArithmetic(prompt: string): string | null {
  const normalised = prompt
    .toLowerCase()
    .replace(/multiplied by/g, "*")
    .replace(/multiply by/g, "*")
    .replace(/\btimes\b/g, "*")
    .replace(/\bplus\b/g, "+")
    .replace(/\badd(?:ed)? to\b/g, "+")
    .replace(/\bminus\b/g, "-")
    .replace(/\bsubtract(?:ed)? (?:from|by)\b/g, "-")
    .replace(/\bdivided by\b/g, "/")
    .replace(/\bdivide by\b/g, "/")
    .replace(/\bmod(?:ulo)?\b/g, "%");
  const m = normalised.match(/[-+/*%().\d]+\s*[-+/*%]\s*[-+/*%().\d]+/);
  return m ? m[0].trim() : null;
}

function matchIntent(prompt: string, available: string[]): ToolIntent | null {
  const p = prompt.trim();
  const lower = p.toLowerCase();
  const has = (name: string) => available.includes(name);

  // Time / date.
  if (has("local_time") && /\b(time|date|today|day|clock)\b/.test(lower)) {
    return { name: "local_time", args: {} };
  }

  // Calculator: an arithmetic expression (symbolic or word-form) or an explicit ask.
  if (has("calculator")) {
    const expr = extractArithmetic(p);
    const explicit = lower.match(/(?:calculate|compute|evaluate|what(?:'s| is) the (?:sum|product|result|value of)|how much is|solve|times|multiplied|plus|minus|divided)\b/);
    if (explicit || expr) {
      return { name: "calculator", args: { expression: expr ?? p } };
    }
  }

  // Translate.
  if (has("translate") && /\btranslate\b/.test(lower)) {
    const langMatch = p.match(/(?:into|to|in)\s+([A-Za-z]+)\b/);
    return {
      name: "translate",
      args: { text: p.replace(/^.*translate\b/i, "").replace(/\s*(?:into|to|in)\s+[A-Za-z]+\b.*/i, "").trim() || p, language: langMatch ? langMatch[1] : "Spanish" },
    };
  }

  // Knowledge add ("remember this …").
  if (has("knowledge_add") && /\b(remember|memorize|note that|add this|store this|learn this)\b/.test(lower)) {
    const text = p.replace(/^.*?\b(remember|memorize|note that|add this|store this|learn this)\b[^:]*?:?\s*/i, "").trim() || p;
    return { name: "knowledge_add", args: { text } };
  }

  // Knowledge search ("what do you know about …").
  if (has("knowledge_search") && /\b(search|look up|find|what do you (?:know|remember)|my notes|knowledge base)\b/.test(lower)) {
    const query = p.replace(/^.*?\b(search(?: my notes)?|look up|find|what do you (?:know|remember)(?: about)?)\b[^:]*?:?\s*/i, "").replace(/\?+$/, "").trim() || p;
    return { name: "knowledge_search", args: { query } };
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Tokenisation + cosine similarity for the mock RAG. Genuinely does
 * retrieval over the ingested corpus — it is the same idea as the real
 * embedding store, just with a lightweight TF vector instead of a 300M
 * embedding model.
 * ------------------------------------------------------------------ */
const TOKEN_RE = /[a-z0-9]+/g;
function tokenize(text: string): string[] {
  return (text.toLowerCase().match(TOKEN_RE) ?? []) as string[];
}
function termFreq(tokens: string[]): Map<string, number> {
  const v = new Map<string, number>();
  for (const t of tokens) v.set(t, (v.get(t) ?? 0) + 1);
  return v;
}
function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let aSq = 0;
  for (const [k, v] of a) {
    aSq += v * v;
    const w = b.get(k);
    if (w !== undefined) dot += v * w;
  }
  if (aSq === 0) return 0;
  let bSq = 0;
  for (const v of b.values()) bSq += v * v;
  if (bSq === 0) return 0;
  return dot / (Math.sqrt(aSq) * Math.sqrt(bSq));
}

/**
 * The offline, deterministic QVAC client. Drop-in for {@link QvacClient}.
 */
export class MockQvacClient implements QvacClient {
  public readonly mode = "mock" as const;

  private seed: number;
  private rng: () => number;
  private readonly defaultWorkspace: string;
  private peerConnected: boolean;

  private readonly models = new Map<string, LoadedMockModel>();
  private seq = 0;
  private readonly workspaces = new Map<string, { text: string; vec: Map<string, number> }[]>();
  private providerActive = false;
  private providerKey: string | null = null;

  constructor(opts: MockQvacOptions = {}) {
    this.seed = opts.seed ?? 1;
    this.rng = mulberry32(this.seed);
    this.defaultWorkspace = opts.workspace ?? "solace";
    this.peerConnected = opts.peerConnected ?? false;
  }

  /* ---- model lifecycle -------------------------------------------------- */
  async loadModel(options: LoadModelOptions): Promise<string> {
    const modelKey = String((options.modelSrc as { constant?: string })?.constant ?? options.modelSrc ?? "mock-model");
    const role: "llm" | "embedding" = (options as { role?: "llm" | "embedding" }).role ?? "llm";
    const modelId = `${modelKey}::${this.seq++}`;
    this.models.set(modelId, {
      modelId,
      modelKey,
      role,
      toolCalling: role === "llm",
    });
    // Simulate the model being ready almost instantly (no GB download).
    await this.delay(2);
    return modelId;
  }

  async unloadModel(modelId: string): Promise<void> {
    this.models.delete(modelId);
  }

  /* ---- completion (+ tool-call emulation) ------------------------------- */
  async completion(options: CompletionOptions): Promise<CompletionResult> {
    const { modelId, history, tools, forceTarget } = options;
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`[mock] model not loaded: ${modelId}. Call loadModel() first.`);
    }

    // Count how many tool-answer rounds have already happened in this run.
    const toolRounds = history.filter((m) => m.role === "tool").length;

    // On the first round, try to emit exactly one tool call (deterministic).
    if (tools && tools.length > 0 && toolRounds === 0 && model.toolCalling) {
      const intent = matchIntent(firstUserText(history), tools.map((t) => t.name));
      if (intent) {
        const stats = this.mockStats(options, /*generated*/ 18);
        return {
          contentText: "",
          toolCalls: [{ id: `call_${this.seq++}`, name: intent.name, arguments: intent.args }],
          stats,
          stopReason: "tool_use",
        };
      }
    }

    // Otherwise (or after tools) produce a final answer.
    const contentText = this.composeAnswer(history, forceTarget);
    const stats = this.mockStats(options, Math.max(16, Math.round(contentText.length / 4)));
    return {
      contentText,
      toolCalls: [],
      stats,
      stopReason: "eos",
    };
  }

  /** Build a realistic, deterministic final answer that reflects the run. */
  private composeAnswer(history: ChatMessage[], forceTarget?: "local" | "peer"): string {
    const prompt = firstUserText(history);
    // The tag reflects the *actual* routing decision for this completion
    // (peerConnected just means a peer is reachable, not that we delegated).
    const delegated = forceTarget === "peer";
    const tag = delegated ? "[🌐 delegated to a peer · bigger on-device brain] " : "[💻 on-device] ";

    // If a tool ran, fold its observation into the answer.
    const toolObs = history.filter((m) => m.role === "tool");
    if (toolObs.length > 0) {
      const obs = toolObs.map((m) => `${m.name}: ${m.content}`).join(" | ");
      return `${tag}Done — ${obs}. Everything ran locally; no cloud call was made.`;
    }

    // Direct (no tool) answer.
    const short = prompt.length > 90 ? `${prompt.slice(0, 89)}…` : prompt;
    return `${tag}On-device answer to "${short}". Connect the real QVAC engine (--real) for full LLM prose; the agent loop, routing and telemetry shown here are identical to that path.`;
  }

  private mockStats(options: CompletionOptions, generated: number): CompletionStats {
    const promptChars = options.history.reduce((n, m) => n + m.content.length, 0);
    return {
      tokensPerSecond: +(40 + this.rng() * 30).toFixed(1),
      promptTokens: Math.max(1, Math.round(promptChars / 4)),
      generatedTokens: generated,
      cacheTokens: 0,
      backendDevice: "cpu",
    };
  }

  /* ---- local RAG -------------------------------------------------------- */
  async ragIngest(options: { modelId: string; documents: string[]; workspace?: string }): Promise<{ ingested: number }> {
    const ws = options.workspace ?? this.defaultWorkspace;
    const store = this.workspaces.get(ws) ?? [];
    for (const doc of options.documents) {
      for (const piece of this.chunk(doc)) {
        store.push({ text: piece, vec: termFreq(tokenize(piece)) });
      }
    }
    this.workspaces.set(ws, store);
    telemetry.record("local", "rag.ingest");
    return { ingested: store.length };
  }

  async ragSearch(options: {
    modelId: string;
    query: string;
    workspace?: string;
    limit?: number;
  }): Promise<{ text: string; score: number }[]> {
    const ws = options.workspace ?? this.defaultWorkspace;
    const store = this.workspaces.get(ws) ?? [];
    const qVec = termFreq(tokenize(options.query));
    const ranked = store
      .map((d) => ({ text: d.text, score: cosine(qVec, d.vec) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit ?? 3);
    telemetry.record("local", "rag.search");
    return ranked;
  }

  /** Simple sentence-aware chunker (mirrors the Python vault). */
  private chunk(text: string): string[] {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return [];
    const sentences = clean.split(/(?<=[.!?])\s+/);
    const out: string[] = [];
    let buf = "";
    for (const s of sentences) {
      if ((buf + " " + s).trim().length > 480 && buf) {
        out.push(buf.trim());
        buf = s;
      } else {
        buf = (buf + " " + s).trim();
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  /* ---- P2P provider (simulated) ----------------------------------------- */
  async startProvider(options?: { seed?: string }): Promise<{ publicKey: string }> {
    this.providerActive = true;
    const hex = Array.from({ length: 8 }, () => Math.floor(this.rng() * 256).toString(16).padStart(2, "0")).join("");
    this.providerKey = options?.seed ?? `solace-peer-${hex}`;
    // Becoming a provider also means we can now *accept* delegated jobs; in a
    // single-process demo we also treat the peer as reachable for routing.
    this.peerConnected = true;
    return { publicKey: this.providerKey };
  }

  async stopProvider(): Promise<void> {
    this.providerActive = false;
    this.providerKey = null;
  }

  get isProviderActive(): boolean {
    return this.providerActive;
  }

  get isPeerConnected(): boolean {
    return this.peerConnected;
  }

  /** Allow the CLI/demo to mark a peer as reachable for routing demos. */
  setPeerConnected(v: boolean): void {
    this.peerConnected = v;
  }

  /* ---- teardown --------------------------------------------------------- */
  async close(): Promise<void> {
    this.models.clear();
    this.workspaces.clear();
    this.providerActive = false;
    this.providerKey = null;
  }

  /* ---- helpers ---------------------------------------------------------- */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
