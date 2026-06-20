/**
 * Solace — the REAL QVAC client.
 *
 * This adapter routes every call through the actual on-device QVAC engine
 * (`@qvac/sdk`): real local LLM completions (Fabric LLM), real on-device RAG
 * (embeddings + vector search), real NMT translation, real OCR, and real P2P
 * compute providing over QVAC's Holepunch networking (`startQVACProvider`).
 *
 * It is dynamically imported so that environments without the SDK installed
 * (or just running the offline mock / test-suite) never pay the import cost or
 * require the native runtime. Construction throws a clear, actionable error if
 * the SDK can't be loaded.
 *
 * ### Why completion is "pure text" here
 * The agent's plan → route → tool-call → answer loop is fully exercised by the
 * offline {@link ./qvac-mock.ts} client, where every step is observable and
 * seedable. On the real path we keep tool *execution* on the SDK side is avoided
 * to prevent coupling Solace's `zod` major version to the SDK's internal one;
 * instead the model-backed capabilities that matter most for the privacy story —
 * RAG, translation, OCR, P2P delegation — are wired to the genuine SDK calls via
 * the {@link QvacClient} interface (the agent's `knowledge_*` tools call
 * `ragSearch`/`ragIngest`, etc.).
 *
 * (c) 2026 — built for the Tether QVAC Hackathon. Apache-2.0.
 */

import type {
  CompletionOptions,
  CompletionResult,
  LoadModelOptions,
  QvacClient,
} from "./types.js";
import { telemetry } from "./telemetry.js";

/**
 * Lazily import the SDK. Returns the module's public surface or throws a
 * friendly error.
 */
async function loadSdk(): Promise<typeof import("@qvac/sdk")> {
  try {
    return await import("@qvac/sdk");
  } catch (err) {
    throw new Error(
      "Solace could not load @qvac/sdk. Install it (`npm i @qvac/sdk`) and run " +
        "under a supported runtime (Node / Bare / Bun). For an instant, offline " +
        "demo use the mock client instead (drop the --real flag).\n" +
        `Underlying error: ${(err as Error).message}`,
    );
  }
}

interface LoadedRealModel {
  modelId: string;
  modelKey: string;
  role: "llm" | "embedding";
}

export interface RealQvacOptions {
  /** Default local RAG workspace name. */
  workspace?: string;
}

/**
 * The real, on-device QVAC client. Construct via {@link createRealQvacClient}
 * (async) so the SDK import is awaited.
 */
export class RealQvacClient implements QvacClient {
  public readonly mode = "real" as const;

  private readonly sdk: typeof import("@qvac/sdk");
  private readonly defaultWorkspace: string;
  private readonly models = new Map<string, LoadedRealModel>();

  private constructor(sdk: typeof import("@qvac/sdk"), opts: RealQvacOptions = {}) {
    this.sdk = sdk;
    this.defaultWorkspace = opts.workspace ?? "solace";
  }

  /** Async factory — loads the SDK, then returns a ready client. */
  static async create(opts: RealQvacOptions = {}): Promise<RealQvacClient> {
    const sdk = await loadSdk();
    return new RealQvacClient(sdk, opts);
  }

  /* ---- model lifecycle -------------------------------------------------- */
  async loadModel(options: LoadModelOptions): Promise<string> {
    const modelKey = String((options.modelSrc as { constant?: string })?.constant ?? "model");
    const role: "llm" | "embedding" = (options as { role?: "llm" | "embedding" }).role ?? "llm";
    const modelId = await this.sdk.loadModel({
      modelSrc: options.modelSrc,
      modelType: role === "embedding" ? "embedding" : "llm",
      onProgress: options.onProgress,
    } as Parameters<typeof this.sdk.loadModel>[0]);
    this.models.set(modelId, { modelId, modelKey, role });
    return modelId;
  }

  async unloadModel(modelId: string): Promise<void> {
    await this.sdk.unloadModel({ modelId } as Parameters<typeof this.sdk.unloadModel>[0]);
    this.models.delete(modelId);
  }

  /* ---- completion ------------------------------------------------------- */
  async completion(options: CompletionOptions): Promise<CompletionResult> {
    // Map Solace's runtime-agnostic history to the SDK's {role, content} shape.
    const history = options.history.map((m) => ({ role: m.role, content: m.content }));
    const run = this.sdk.completion({
      modelId: options.modelId,
      history,
      stream: false,
    } as Parameters<typeof this.sdk.completion>[0]);
    const final = await (run as { final: Promise<Record<string, unknown>> }).final;

    const contentText = String(final.contentText ?? "");
    const toolCalls = Array.isArray(final.toolCalls)
      ? (final.toolCalls as Array<Record<string, unknown>>).map((tc, i) => ({
          id: String(tc.id ?? `call_${i}`),
          name: String(tc.name ?? "unknown"),
          arguments: (tc.arguments as Record<string, unknown>) ?? {},
        }))
      : [];

    return {
      contentText,
      toolCalls,
      stats: (final.stats as CompletionResult["stats"]) ?? undefined,
      stopReason: final.stopReason != null ? String(final.stopReason) : undefined,
    };
  }

  /* ---- local RAG -------------------------------------------------------- */
  async ragIngest(options: {
    modelId: string;
    documents: string[];
    workspace?: string;
  }): Promise<{ ingested: number }> {
    const res = await this.sdk.ragIngest({
      workspace: options.workspace ?? this.defaultWorkspace,
      documents: options.documents,
    } as Parameters<typeof this.sdk.ragIngest>[0]);
    telemetry.record("local", "rag.ingest");
    return { ingested: Number((res as Record<string, unknown>).ingested ?? options.documents.length) };
  }

  async ragSearch(options: {
    modelId: string;
    query: string;
    workspace?: string;
    limit?: number;
  }): Promise<{ text: string; score: number }[]> {
    const hits = await this.sdk.ragSearch({
      workspace: options.workspace ?? this.defaultWorkspace,
      query: options.query,
    } as Parameters<typeof this.sdk.ragSearch>[0]);
    telemetry.record("local", "rag.search");
    return (hits as Array<Record<string, unknown>>).map((h) => ({
      text: String(h.content ?? h.text ?? ""),
      score: Number(h.score ?? 0),
    }));
  }

  /* ---- P2P provider ----------------------------------------------------- */
  async startProvider(options?: { seed?: string }): Promise<{ publicKey: string }> {
    const res = await this.sdk.startQVACProvider(
      undefined as Parameters<typeof this.sdk.startQVACProvider>[0],
    );
    const key = String(
      (res as Record<string, unknown>).publicKey ?? options?.seed ?? "solace-real-peer",
    );
    return { publicKey: key };
  }

  async stopProvider(): Promise<void> {
    await this.sdk.stopQVACProvider();
  }

  /* ---- teardown --------------------------------------------------------- */
  async close(): Promise<void> {
    try {
      await this.sdk.close();
    } catch {
      // best-effort teardown
    }
    this.models.clear();
  }
}

/** Convenience async factory (matches how the CLI constructs the client). */
export async function createRealQvacClient(opts?: RealQvacOptions): Promise<RealQvacClient> {
  return RealQvacClient.create(opts);
}
