/**
 * Unit tests for the local tool-kit (calculator safety, tool registry).
 */
import { describe, expect, it } from "vitest";
import { buildTools, findTool, safeCalculate } from "../src/tools.js";
import { MockQvacClient } from "../src/qvac-mock.js";

describe("safeCalculate", () => {
  it("evaluates basic arithmetic", () => {
    expect(safeCalculate("2 + 2")).toBe(4);
    expect(safeCalculate("(12 * 8) + 5")).toBe(101);
    expect(safeCalculate("100 % 7")).toBe(2);
    expect(safeCalculate("10 / 4")).toBe(2.5);
  });

  it("refuses anything that is not pure arithmetic", () => {
    expect(() => safeCalculate("require('fs')")).toThrow();
    expect(() => safeCalculate("process.exit()")).toThrow();
    expect(() => safeCalculate("")).toThrow();
    // strips surrounding text but keeps the numeric core
    expect(safeCalculate("what is 17 * 23")).toBe(17 * 23);
  });

  it("rejects non-finite results", () => {
    expect(() => safeCalculate("1 / 0")).toThrow();
  });
});

describe("buildTools", () => {
  const client = new MockQvacClient();
  const tools = buildTools(client, { embeddingModelId: "embed" });

  it("registers the expected local tools", () => {
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "local_time",
        "calculator",
        "knowledge_search",
        "knowledge_add",
        "translate",
      ]),
    );
  });

  it("calculator handler returns an equation string", () => {
    const calc = findTool(tools, "calculator")!;
    expect(calc.handler({ expression: "6 * 7" })).toBe("6 * 7 = 42");
  });

  it("local_time returns a parseable date", () => {
    const time = findTool(tools, "local_time")!;
    const out = time.handler({});
    expect(new Date(out).toString()).not.toBe("Invalid Date");
  });

  it("knowledge_add/ingests into the private store and search retrieves it", async () => {
    const embed = "embed-model";
    const tools = buildTools(client, { embeddingModelId: embed, workspace: "test-ws" });
    const add = findTool(tools, "knowledge_add")!;
    const search = findTool(tools, "knowledge_search")!;
    await add.handler({ text: "Solace runs fully on-device with zero cloud calls." });
    await add.handler({ text: "The quick brown fox jumps over the lazy dog." });
    const res = await search.handler({ query: "does solace use the cloud" });
    expect(res).toContain("Solace runs fully on-device");
  });

  it("translate handler returns a clearly-marked on-device result", () => {
    const tr = findTool(tools, "translate")!;
    const out = tr.handler({ text: "hello", language: "Spanish" });
    expect(out).toContain("on-device translate");
    expect(out).toContain("Spanish");
  });
});
