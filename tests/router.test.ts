/**
 * Unit tests for the routing brain — Solace's local-vs-peer decision function.
 *
 * The router is a pure, deterministic function, so we can assert exact
 * decisions across the full prompt/step/peer matrix.
 */
import { describe, expect, it } from "vitest";
import { route, routeAll, formatDecision } from "../src/router.js";
import type { RoutingContext } from "../src/router.js";

function ctx(over: Partial<RoutingContext> = {}): RoutingContext {
  return {
    prompt: "hi",
    promptTokens: 10,
    step: 0,
    peerAvailable: false,
    localSupportsTools: true,
    ...over,
  };
}

describe("router", () => {
  it("always routes local when no peer is available (privacy never breaks)", () => {
    const d = route(ctx({ prompt: "summarize this huge document", promptTokens: 5000, peerAvailable: false }));
    expect(d.target).toBe("local");
    expect(d.reason).toContain("no peer");
  });

  it("forces the requested target", () => {
    expect(route(ctx({ force: "peer" })).target).toBe("peer");
    expect(route(ctx({ force: "local" })).target).toBe("local");
  });

  it("delegates heavy prompts to a peer when one is reachable", () => {
    const heavy = route(ctx({ prompt: "summarize this 40 page report", promptTokens: 1400, peerAvailable: true }));
    expect(heavy.target).toBe("peer");
    expect(heavy.reason).toMatch(/long|bigger context/);
  });

  it("delegates explicit reasoning keywords to a peer", () => {
    for (const kw of ["analyze this", "compare", "reason step by step", "evaluate"]) {
      const d = route(ctx({ prompt: kw, peerAvailable: true }));
      expect(d.target).toBe("peer");
    }
  });

  it("keeps light/trivial jobs local even with a peer", () => {
    for (const kw of ["what time is it", "sum of 2 and 2", "calculate 5*5"]) {
      const d = route(ctx({ prompt: kw, peerAvailable: true }));
      expect(d.target).toBe("local");
    }
  });

  it("delegates later agent steps to a bigger peer model", () => {
    const d = route(ctx({ prompt: "continue", step: 2, peerAvailable: true }));
    expect(d.target).toBe("peer");
  });

  it("formatDecision renders an icon + reason", () => {
    const local = formatDecision({ target: "local", reason: "x" });
    const peer = formatDecision({ target: "peer", reason: "y" });
    expect(local).toContain("💻 local");
    expect(peer).toContain("🌐 peer");
  });

  it("routeAll maps over a list", () => {
    const out = routeAll([ctx({ force: "peer" }), ctx({ force: "local" })]);
    expect(out).toHaveLength(2);
    expect(out[0].target).toBe("peer");
    expect(out[1].target).toBe("local");
  });
});
