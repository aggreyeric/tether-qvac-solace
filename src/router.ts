/**
 * Solace — the routing brain.
 *
 * This is Solace's signature idea: an on-device agent that *decides* whether the
 * current job is cheap enough to run on the local model, or heavy enough to
 * "upgrade its brain" by delegating the inference to a peer over QVAC's P2P
 * network. It is a pure, deterministic function over a {@link RoutingContext} so
 * it can be unit-tested exhaustively and audited.
 *
 * Heuristics (transparent, no ML):
 *   - Long inputs / explicit "deep reasoning" keywords → peer (bigger brain).
 *   - Tool-calling steps after the first → peer (the small model struggles with
 *     multi-turn planning).
 *   - Everything else → local (fast, free, fully private).
 *
 * When no peer is connected we always fall back to local — privacy is never
 * broken by routing.
 */

import type { RoutingDecision, RoutingTarget } from "./types.js";

export interface RoutingContext {
  /** The user's latest message. */
  prompt: string;
  /** Approximate prompt token length (chars / 4 is a fine proxy). */
  promptTokens: number;
  /** Which agent step we're on (0 = first). */
  step: number;
  /** Is a peer provider connected right now? */
  peerAvailable: boolean;
  /** Does the local model support tool-calling? (small non-TC models delegate sooner) */
  localSupportsTools: boolean;
  /** Force a target (from CLI flags) — bypasses heuristics. */
  force?: RoutingTarget;
}

/** Keywords that signal a job wants a bigger brain. */
const HEAVY_KEYWORDS = [
  "summarize this",
  "summarise this",
  "analyze this",
  "analyse this",
  "reason",
  "step by step",
  "compare",
  "evaluate",
  "translate this document",
  "research",
  "plan a",
  "design a",
];

/** Keywords that signal a job is trivially local (never delegate). */
const LIGHT_KEYWORDS = ["what time", "what's the time", "time is it", "sum of", "calculate"];

function looksHeavy(ctx: RoutingContext): string | null {
  if (ctx.promptTokens >= 1200) {
    return `prompt is long (~${ctx.promptTokens} tokens) — bigger context pays off on a peer`;
  }
  const lower = ctx.prompt.toLowerCase();
  for (const kw of HEAVY_KEYWORDS) {
    if (lower.includes(kw)) {
      return `prompt asks for heavier reasoning ("${kw}")`;
    }
  }
  if (ctx.step >= 1 && ctx.localSupportsTools === false) {
    return `multi-step tool use on a small non-tool-calling model — delegate planning`;
  }
  if (ctx.step >= 2) {
    return `agent has taken ${ctx.step} steps — a bigger peer model plans better`;
  }
  return null;
}

function looksLight(ctx: RoutingContext): string | null {
  const lower = ctx.prompt.toLowerCase();
  for (const kw of LIGHT_KEYWORDS) {
    if (lower.includes(kw)) return `looks like a quick ${kw} …`;
  }
  return null;
}

/**
 * Decide where the next completion runs.
 *
 * Contract: if `peerAvailable === false`, the answer is ALWAYS `local`
 * (we never silently degrade or break privacy by touching a cloud).
 */
export function route(ctx: RoutingContext): RoutingDecision {
  if (ctx.force) {
    return {
      target: ctx.force,
      reason: `forced via --${ctx.force}`,
    };
  }

  const light = looksLight(ctx);

  if (!ctx.peerAvailable) {
    return {
      target: "local",
      reason: light ?? "no peer connected — running locally (fully private)",
    };
  }

  const heavy = looksHeavy(ctx);
  if (heavy) {
    return { target: "peer", reason: heavy };
  }
  return {
    target: "local",
    reason: light ?? "small/quick job — fast and free on-device",
  };
}

/** Pretty-print a decision for the CLI/dashboard. */
export function formatDecision(d: RoutingDecision): string {
  const icon = d.target === "peer" ? "🌐 peer" : "💻 local";
  return `${icon} — ${d.reason}`;
}

/** Convenience for tests/builders: the set of decisions over a prompt list. */
export function routeAll(
  contexts: RoutingContext[],
): { target: RoutingTarget; reason: string }[] {
  return contexts.map(route);
}
