/**
 * Solace — core types.
 *
 * The whole app talks to QVAC through the {@link QvacClient} interface. There are
 * two implementations:
 *   - {@link RealQvacClient} (`./qvac-real.ts`) — dynamically imports `@qvac/sdk`
 *     and runs real on-device inference. Needs the SDK + a downloaded model.
 *   - {@link MockQvacClient} (`./qvac-mock.ts`) — a deterministic, offline
 *     in-process engine used by tests and the `--mock` demo so you can feel the
 *     full agent experience instantly, with zero downloads.
 *
 * Keeping the SDK behind an interface is what lets the agent / router / telemetry
 * logic be fully unit-tested without multi-gigabyte model weights.
 *
 * (c) 2026 — built for the Tether QVAC Hackathon. Apache-2.0.
 */

/** A chat message in Solace's internal, runtime-agnostic format. */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Present on assistant messages that requested tool calls. */
  toolCalls?: ToolCall[];
  /** Present on `tool`-role messages: which call this is answering. */
  toolCallId?: string;
  /** Present on `tool`-role messages: which tool produced this. */
  name?: string;
}

/** A tool/function the agent can call. Mirrors the QVAC / OpenAI tool schema. */
export interface ToolSpec {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** A concrete tool: a {@link ToolSpec} plus an executable handler. */
export interface Tool extends ToolSpec {
  /** Run the tool. Must return a string (so it can go back into the prompt). */
  handler: (args: Record<string, unknown>) => Promise<string> | string;
}

/** A tool call emitted by the model. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Per-completion performance telemetry. */
export interface CompletionStats {
  tokensPerSecond?: number;
  promptTokens?: number;
  generatedTokens?: number;
  cacheTokens?: number;
  backendDevice?: "cpu" | "gpu";
}

/** Normalised completion result returned by every {@link QvacClient}. */
export interface CompletionResult {
  /** The model's textual answer (empty when it only emitted tool calls). */
  contentText: string;
  toolCalls: ToolCall[];
  stats?: CompletionStats;
  stopReason?: string;
}

/** Routed routing decision for a single completion. */
export type RoutingTarget = "local" | "peer";

export interface RoutingDecision {
  target: RoutingTarget;
  /** Human-readable reason, surfaced in the telemetry panel. */
  reason: string;
}

/** Where a piece of inference actually ran — for the zero-cloud audit. */
export type InferenceSite = "local" | "peer" | "cloud";

/** Options for loading a model. */
export interface LoadModelOptions {
  /** A QVAC model constant (e.g. `LLAMA_3_2_1B_INST_Q4_0`). */
  modelSrc: unknown;
  /** When set, the model is loaded on a remote peer instead of locally. */
  delegate?: {
    providerPublicKey: string;
    timeout?: number;
    fallbackToLocal?: boolean;
  };
  onProgress?: (p: { percentage: number; downloaded: number; total: number }) => void;
}

/** Options for a completion request. */
export interface CompletionOptions {
  modelId: string;
  history: ChatMessage[];
  tools?: Tool[];
  systemPrompt?: string;
  /** Override auto routing and force a target for this call. */
  forceTarget?: RoutingTarget;
}

/**
 * The single seam between Solace and the QVAC SDK.
 * Every consumer (agent, router, server) depends on this interface, never on
 * `@qvac/sdk` directly.
 */
export interface QvacClient {
  readonly mode: "real" | "mock";

  /** Load (or attach to a peer) a model and return its opaque id. */
  loadModel(options: LoadModelOptions): Promise<string>;

  /** Run a completion and resolve to the normalised final result. */
  completion(options: CompletionOptions): Promise<CompletionResult>;

  /** Unload a model to free memory. */
  unloadModel(modelId: string): Promise<void>;

  /** Ingest documents into a local, on-device RAG workspace. */
  ragIngest?(options: {
    modelId: string;
    documents: string[];
    workspace?: string;
  }): Promise<{ ingested: number }>;

  /** Semantic search over a local RAG workspace. */
  ragSearch?(options: {
    modelId: string;
    query: string;
    workspace?: string;
    limit?: number;
  }): Promise<{ text: string; score: number }[]>;

  /** Become a QVAC compute provider on the P2P network. */
  startProvider?(options?: {
    seed?: string;
  }): Promise<{ publicKey: string }>;

  /** Stop being a provider. */
  stopProvider?(): Promise<void>;

  /** Tear down all resources. */
  close(): Promise<void>;
}

/** One step in an agent trace — what the agent did and what it learned. */
export interface AgentStep {
  step: number;
  toolCalls: ToolCall[];
  /** Per-tool results, keyed by tool name. */
  observations: { name: string; result: string }[];
  /** Where this step's inference ran. */
  site: InferenceSite;
}

/** The final outcome of an agent run. */
export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  /** Did the agent ever delegate to a peer? */
  usedPeer: boolean;
  /** Number of cloud calls made — must always be 0 for Solace. */
  cloudCalls: number;
  totalCalls: number;
}
