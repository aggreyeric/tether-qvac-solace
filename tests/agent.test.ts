/**
 * Integration tests: the mock QVAC client + the Solace agent loop.
 *
 * These exercise the full plan → route → tool-call → answer cycle against the
 * deterministic offline engine, so the agent's behaviour is asserted without
 * needing multi-gigabyte model weights.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { MockQvacClient } from "../src/qvac-mock.js";
import { SolaceAgent } from "../src/agent.js";
import { telemetry } from "../src/telemetry.js";
import { MODELS, DEFAULT_LLM, DEFAULT_EMBEDDING } from "../src/models.js";

async function makeAgent(opts: { peer?: boolean; seed?: boolean; force?: "local" | "peer" } = {}) {
  const client = new MockQvacClient({ workspace: "agent-test" });
  const llm = await client.loadModel({ modelSrc: MODELS[DEFAULT_LLM], role: "llm" } as never);
  const embed = await client.loadModel({ modelSrc: MODELS[DEFAULT_EMBEDDING], role: "embedding" } as never);
  if (opts.seed && client.ragIngest) {
    await client.ragIngest({
      modelId: embed,
      documents: [
        "Bitcoin has a fixed supply of 21 million coins and a four-year halving cycle.",
        "Ethereum switched to proof-of-stake in the 2022 Merge.",
      ],
      workspace: "agent-test",
    });
  }
  const agent = new SolaceAgent({
    client,
    modelId: llm,
    embeddingModelId: embed,
    workspace: "agent-test",
    peerAvailable: opts.peer ?? false,
    forceTarget: opts.force,
  });
  return { agent, client };
}

describe("MockQvacClient", () => {
  it("loads models and reports mode=mock", async () => {
    const client = new MockQvacClient();
    expect(client.mode).toBe("mock");
    const id = await client.loadModel({ modelSrc: MODELS[DEFAULT_LLM], role: "llm" } as never);
    expect(id).toMatch(/::\d+$/);
  });

  it("does real cosine retrieval over an ingested corpus", async () => {
    const client = new MockQvacClient();
    const embed = await client.loadModel({ modelSrc: MODELS[DEFAULT_EMBEDDING], role: "embedding" } as never);
    await client.ragIngest({
      modelId: embed,
      documents: ["cats love warm sunny windows", "blockchain blocks are chained by hashes"],
      workspace: "r",
    });
    const hits = await client.ragSearch({ modelId: embed, query: "how are blocks linked together", workspace: "r" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].text).toContain("blockchain");
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it("becomes a P2P provider with a deterministic public key", async () => {
    const a = new MockQvacClient({ seed: 42 });
    const b = new MockQvacClient({ seed: 42 });
    const ra = await a.startProvider();
    const rb = await b.startProvider();
    expect(ra.publicKey).toBe(rb.publicKey); // deterministic
    expect(a.isProviderActive).toBe(true);
    await a.stopProvider();
    expect(a.isProviderActive).toBe(false);
  });
});

describe("SolaceAgent loop", () => {
  beforeEach(() => telemetry.reset());

  it("uses the calculator tool and folds the result into the answer", async () => {
    const { agent } = await makeAgent();
    const res = await agent.run("What is 17 multiplied by 23?");
    expect(res.cloudCalls).toBe(0);
    expect(res.answer).toContain("391");
    // one tool-call step + one final step
    expect(res.steps.length).toBeGreaterThanOrEqual(2);
    expect(res.steps.some((s) => s.toolCalls.some((tc) => tc.name === "calculator"))).toBe(true);
  });

  it("answers directly (no tools) for plain chat", async () => {
    const { agent } = await makeAgent();
    const res = await agent.run("Tell me a fun fact.");
    expect(res.cloudCalls).toBe(0);
    expect(res.answer.length).toBeGreaterThan(0);
    expect(res.steps.every((s) => s.toolCalls.length === 0)).toBe(true);
  });

  it("uses the private knowledge base to answer grounded questions", async () => {
    const { agent } = await makeAgent({ seed: true });
    const res = await agent.run("What do you know about bitcoin's supply?");
    expect(res.cloudCalls).toBe(0);
    expect(res.steps.some((s) => s.toolCalls.some((tc) => tc.name === "knowledge_search"))).toBe(true);
    expect(res.answer).toContain("21 million");
  });

  it("delegates heavy work to a peer when one is reachable", async () => {
    const { agent } = await makeAgent({ peer: true });
    const res = await agent.run("Summarize this 40 page report and compare the regimes step by step");
    expect(res.usedPeer).toBe(true);
    expect(res.cloudCalls).toBe(0);
  });

  it("keeps light work local even with a peer available", async () => {
    const { agent } = await makeAgent({ peer: true });
    const res = await agent.run("calculate 5 * 5");
    expect(res.usedPeer).toBe(false);
    expect(res.cloudCalls).toBe(0);
  });

  it("emits routing/tool/answer events", async () => {
    const events: string[] = [];
    const client = new MockQvacClient();
    const llm = await client.loadModel({ modelSrc: MODELS[DEFAULT_LLM], role: "llm" } as never);
    const agent = new SolaceAgent({
      client,
      modelId: llm,
      onEvent: (e) => events.push(e.type),
    });
    await agent.run("What is 9 + 10?");
    expect(events).toContain("route");
    expect(events).toContain("tool");
    expect(events).toContain("answer");
  });
});
