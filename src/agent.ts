/**
 * Solace — the agent loop.
 *
 * This is the brain that turns a user task into a routed, tool-using, audited
 * answer:
 *
 *   1. build the local tool-kit (every tool runs on-device)
 *   2. for up to `maxSteps` rounds:
 *        a. ask the {@link route router} where the next completion should run
 *           (local vs. a peer over QVAC's P2P network)
 *        b. call the QVAC client at that site, recording telemetry
 *        c. if the model emitted tool calls, execute them locally and loop
 *        d. otherwise return the answer
 *
 * Every step is accounted for in the {@link telemetry} audit trail, whose
 * headline invariant is `cloudCalls === 0`. The loop is fully client-agnostic,
 * so it is identical whether the brain is the offline mock or the real QVAC
 * Fabric LLM.
 *
 * (c) 2026 — built for the Tether QVAC Hackathon. Apache-2.0.
 */

import type {
  AgentResult,
  AgentStep,
  ChatMessage,
  InferenceSite,
  QvacClient,
  ToolCall,
} from "./types.js";
import { route, type RoutingContext } from "./router.js";
import { buildTools, findTool } from "./tools.js";
import { telemetry, type Telemetry } from "./telemetry.js";

export interface SolaceAgentOptions {
  /** A loaded QVAC client (mock or real). */
  client: QvacClient;
  /** Opaque model id returned by `client.loadModel()`. */
  modelId: string;
  /** Embedding model id, needed by the knowledge tools. */
  embeddingModelId?: string;
  /** Optional system prompt shaping the agent's persona. */
  systemPrompt?: string;
  /** Local RAG workspace name for the knowledge tools. */
  workspace?: string;
  /** Max tool-calling rounds before the agent gives back its best answer. */
  maxSteps?: number;
  /** Is a peer provider reachable, so the router may elect to delegate? */
  peerAvailable?: boolean;
  /** Does the local model support native tool-calling? */
  localSupportsTools?: boolean;
  /** Force every completion to a site (CLI `--local` / `--peer`). */
  forceTarget?: "local" | "peer";
  /** Telemetry sink (defaults to the process singleton). */
  telemetry?: Telemetry;
  /** Live progress callback (used by the CLI / dashboard). */
  onEvent?: (e: AgentEvent) => void;
}

export type AgentEvent =
  | { type: "route"; step: number; site: InferenceSite; reason: string }
  | { type: "tool"; step: number; name: string; result: string }
  | { type: "answer"; step: number; site: InferenceSite; answer: string };

const DEFAULT_SYSTEM_PROMPT =
  "You are Solace, a sovereign AI assistant that runs entirely on the user's device. " +
  "Prefer local tools (calculator, knowledge base, translation) and never assume internet access. " +
  "Be concise. All data stays on-device.";

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

/**
 * The Solace agent. Construct once (after loading a model), then call
 * {@link SolaceAgent.run} per task.
 */
export class SolaceAgent {
  private readonly client: QvacClient;
  private readonly modelId: string;
  private readonly embeddingModelId?: string;
  private readonly systemPrompt: string;
  private readonly workspace: string;
  private readonly maxSteps: number;
  private readonly peerAvailable: boolean;
  private readonly localSupportsTools: boolean;
  private readonly forceTarget?: "local" | "peer";
  private readonly telemetry: Telemetry;
  private readonly onEvent?: (e: AgentEvent) => void;

  constructor(opts: SolaceAgentOptions) {
    this.client = opts.client;
    this.modelId = opts.modelId;
    this.embeddingModelId = opts.embeddingModelId;
    this.systemPrompt = opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.workspace = opts.workspace ?? "solace";
    this.maxSteps = opts.maxSteps ?? 4;
    this.peerAvailable = opts.peerAvailable ?? false;
    this.localSupportsTools = opts.localSupportsTools ?? true;
    this.forceTarget = opts.forceTarget;
    this.telemetry = opts.telemetry ?? telemetry;
    this.onEvent = opts.onEvent;
  }

  /** Run a task to completion, returning the answer + a full audit trace. */
  async run(prompt: string): Promise<AgentResult> {
    const tools = buildTools(this.client, {
      workspace: this.workspace,
      embeddingModelId: this.embeddingModelId,
    });

    const history: ChatMessage[] = [
      { role: "system", content: this.systemPrompt },
      { role: "user", content: prompt },
    ];

    const steps: AgentStep[] = [];
    let usedPeer = false;
    let answer = "";

    for (let step = 0; step < this.maxSteps; step++) {
      const ctx: RoutingContext = {
        prompt,
        promptTokens: estimateTokens(prompt),
        step,
        peerAvailable: this.peerAvailable,
        localSupportsTools: this.localSupportsTools,
        force: this.forceTarget,
      };
      const decision = route(ctx);
      const site: InferenceSite = decision.target === "peer" ? "peer" : "local";
      if (site === "peer") usedPeer = true;
      this.onEvent?.({ type: "route", step, site, reason: decision.reason });

      const started = Date.now();
      const result = await this.client.completion({
        modelId: this.modelId,
        history,
        tools,
        systemPrompt: this.systemPrompt,
        forceTarget: decision.target,
      });
      const ms = Date.now() - started;
      this.telemetry.recordCompletion(site, `agent.step${step}`, result.stats, ms);

      // ---- tool calls ----------------------------------------------------
      if (result.toolCalls.length > 0) {
        const observations: AgentStep["observations"] = [];
        // Push the assistant turn that requested the calls, then each answer.
        history.push({
          role: "assistant",
          content: result.contentText,
          toolCalls: result.toolCalls,
        });
        for (const call of result.toolCalls) {
          const obs = await this.runTool(call, tools);
          history.push({ role: "tool", content: obs, toolCallId: call.id, name: call.name });
          observations.push({ name: call.name, result: obs });
          this.onEvent?.({ type: "tool", step, name: call.name, result: obs });
        }
        steps.push({ step, toolCalls: result.toolCalls, observations, site });
        continue; // loop to let the model use the observation
      }

      // ---- final answer --------------------------------------------------
      answer = result.contentText;
      steps.push({ step, toolCalls: [], observations: [], site });
      this.onEvent?.({ type: "answer", step, site, answer });
      break;
    }

    if (!answer && steps.length > 0) {
      answer = "(agent reached its step limit without a final answer)";
    }

    return {
      answer,
      steps,
      usedPeer,
      cloudCalls: 0,
      totalCalls: steps.length,
    };
  }

  private async runTool(call: ToolCall, tools: ReturnType<typeof buildTools>): Promise<string> {
    const tool = findTool(tools, call.name);
    if (!tool) return `error: unknown tool "${call.name}"`;
    try {
      return await tool.handler(call.arguments);
    } catch (err) {
      return `error: ${(err as Error).message}`;
    }
  }
}
