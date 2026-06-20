/**
 * Unit tests for the zero-cloud telemetry audit trail.
 *
 * The headline invariant: cloudCalls is ALWAYS 0 for Solace, and local/peer
 * counts reflect what actually ran.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { Telemetry } from "../src/telemetry.js";

describe("Telemetry", () => {
  let t: Telemetry;

  beforeEach(() => {
    t = new Telemetry();
  });

  it("starts empty with zero cloud calls", () => {
    const s = t.snapshot();
    expect(s.cloudCalls).toBe(0);
    expect(s.localCalls).toBe(0);
    expect(s.peerCalls).toBe(0);
    expect(s.totalCalls).toBe(0);
    expect(s.headline).toContain("0 cloud calls");
  });

  it("counts local and peer inferences separately", () => {
    t.record("local", "agent.step0");
    t.record("local", "rag.search");
    t.record("peer", "agent.step1");
    const s = t.snapshot();
    expect(s.localCalls).toBe(2);
    expect(s.peerCalls).toBe(1);
    expect(s.offCloudCalls).toBe(3);
    expect(s.totalCalls).toBe(3);
  });

  it("can never record a cloud call — the privacy guarantee", () => {
    // Even if someone tried to record a cloud event, the headline flips to warn.
    t.record("cloud", "should-not-happen");
    const s = t.snapshot();
    expect(s.cloudCalls).toBe(1);
    expect(s.headline).toContain("privacy compromised");
  });

  it("records tokens from completion stats", () => {
    t.recordCompletion("local", "x", { generatedTokens: 42 });
    t.recordCompletion("peer", "y", { generatedTokens: 8 });
    expect(t.snapshot().totalTokens).toBe(50);
  });

  it("events carry a monotonic sequence and uptime", () => {
    t.record("local", "a");
    t.record("peer", "b");
    const s = t.snapshot();
    expect(s.events[0].seq).toBe(0);
    expect(s.events[1].seq).toBe(1);
    expect(s.events[0].at).toBeGreaterThanOrEqual(0);
  });

  it("reset clears everything", () => {
    t.record("local", "a");
    t.reset();
    expect(t.snapshot().totalCalls).toBe(0);
  });
});
