/**
 * Smoke test — the cheapest possible "does it boot?" check.
 *
 * While router.test.ts exhaustively exercises the routing heuristics, this test
 * only cares that the core module graph loads and the headline entry points can
 * be called without throwing. It is the canary that catches a broken import,
 * a bad `export`, or a type/runtime mismatch introduced during a refactor.
 *
 * Runs as part of the normal suite:  `npm test`
 */
import { describe, expect, it } from "vitest";
import { route, routeAll, formatDecision } from "../src/router.js";
import type { RoutingContext } from "../src/router.js";

// A minimal, valid routing context — a happy-path "hello".
function baseCtx(over: Partial<RoutingContext> = {}): RoutingContext {
  return {
    prompt: "hello",
    promptTokens: 4,
    step: 0,
    peerAvailable: false,
    localSupportsTools: true,
    ...over,
  };
}

describe("smoke: router module boots", () => {
  it("imports the router without throwing", () => {
    // If this line executes at all, the module graph resolved and loaded.
    expect(typeof route).toBe("function");
    expect(typeof routeAll).toBe("function");
    expect(typeof formatDecision).toBe("function");
  });

  it("route() returns a well-formed decision for a basic prompt", () => {
    const decision = route(baseCtx());
    // The decision must be one of the two valid targets.
    expect(["local", "peer"]).toContain(decision.target);
    // And it always carries a human-readable reason.
    expect(typeof decision.reason).toBe("string");
    expect(decision.reason.length).toBeGreaterThan(0);
  });

  it("never breaks privacy: no peer ⇒ always local", () => {
    // Even for a deliberately "heavy" prompt, without a peer we stay on-device.
    const decision = route(baseCtx({ prompt: "summarize this huge document", promptTokens: 5000 }));
    expect(decision.target).toBe("local");
  });

  it("formatDecision() renders without throwing", () => {
    const decision = route(baseCtx());
    const rendered = formatDecision(decision);
    expect(typeof rendered).toBe("string");
    expect(rendered.length).toBeGreaterThan(0);
  });

  it("routeAll() maps over a list without throwing", () => {
    const out = routeAll([baseCtx(), baseCtx({ peerAvailable: true, prompt: "analyze this" })]);
    expect(out).toHaveLength(2);
    for (const d of out) {
      expect(["local", "peer"]).toContain(d.target);
    }
  });
});
