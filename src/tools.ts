/**
 * Solace — the agent's local tool-kit.
 *
 * Every tool here runs on-device: no network, no cloud. The "knowledge_*" tools
 * are backed by QVAC's local RAG (private vector store); "translate" and
 * "summarize" are backed by on-device inference. The "time" and "calculator"
 * tools are pure functions.
 *
 * Tools are built by {@link buildTools}, which closes over the live
 * {@link QvacClient} so the model-backed ones can actually call QVAC.
 */

import type { QvacClient, Tool } from "./types.js";

/** Safe, dependency-free arithmetic over + - * / % ( ) and decimals. */
export function safeCalculate(expression: string): number {
  const cleaned = expression.replace(/[^0-9+\-*/%().\s]/g, "").trim();
  if (!cleaned) throw new Error("empty expression");
  if (!/^[0-9+\-*/%().\s]+$/.test(cleaned)) {
    throw new Error(`refused potentially unsafe expression: ${expression}`);
  }
  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${cleaned});`)();
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error(`did not evaluate to a finite number: ${expression}`);
  }
  return result;
}

const timeTool: Tool = {
  type: "function",
  name: "local_time",
  description:
    "Get the current local date and time on this device. Use whenever the user asks about the time, date, or scheduling.",
  parameters: { type: "object", properties: {} },
  handler: () => new Date().toString(),
};

const calculatorTool: Tool = {
  type: "function",
  name: "calculator",
  description:
    "Evaluate a basic arithmetic expression (supports + - * / % and parentheses). Use for any math the user asks for.",
  parameters: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "The arithmetic expression, e.g. '(12 * 8) + 5'",
      },
    },
    required: ["expression"],
  },
  handler: (args) => {
    const expr = String(args.expression ?? "");
    const value = safeCalculate(expr);
    return `${expr} = ${value}`;
  },
};

export interface BuildToolsOptions {
  /** RAG workspace name to read/write private knowledge. */
  workspace?: string;
  /** Embedding model id (required for knowledge tools to work). */
  embeddingModelId?: string;
}

/**
 * Build the full tool-kit. The model-backed tools gracefully degrade: if the
 * client doesn't expose RAG, the knowledge tools return a clear message.
 */
export function buildTools(client: QvacClient, opts: BuildToolsOptions = {}): Tool[] {
  const workspace = opts.workspace ?? "solace";

  const knowledgeSearch: Tool = {
    type: "function",
    name: "knowledge_search",
    description:
      "Search this device's PRIVATE knowledge base (local RAG). Use when the user asks about notes/documents you may have ingested. Data never leaves the device.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language search query." },
      },
      required: ["query"],
    },
    handler: async (args) => {
      if (!client.ragSearch) return "knowledge base unavailable (client has no RAG)";
      const query = String(args.query ?? "");
      const hits = await client.ragSearch({ modelId: opts.embeddingModelId ?? "", query, workspace, limit: 3 });
      if (hits.length === 0) return `no matches in the private knowledge base for "${query}"`;
      return hits
        .map((h, i) => `[${i + 1}] (score ${h.score.toFixed(2)}) ${h.text}`)
        .join("\n");
    },
  };

  const knowledgeAdd: Tool = {
    type: "function",
    name: "knowledge_add",
    description:
      "Add text to this device's PRIVATE knowledge base (local RAG). Use when the user says 'remember this' or 'add this to your notes'.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text to remember." },
      },
      required: ["text"],
    },
    handler: async (args) => {
      if (!client.ragIngest) return "knowledge base unavailable (client has no RAG)";
      const text = String(args.text ?? "");
      if (!text.trim()) return "refused to ingest empty text";
      const res = await client.ragIngest({ modelId: opts.embeddingModelId ?? "", documents: [text], workspace });
      return `stored in private knowledge base (${res.ingested} chunk(s))`;
    },
  };

  const translate: Tool = {
    type: "function",
    name: "translate",
    description:
      "Translate text on-device. Use when the user asks to translate into another language.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to translate." },
        language: { type: "string", description: "Target language, e.g. 'Spanish'." },
      },
      required: ["text", "language"],
    },
    handler: (args) => {
      const text = String(args.text ?? "");
      const language = String(args.language ?? "");
      // The real QVAC adapter overrides this tool with a model-backed one; this
      // pure fallback returns a clearly-marked placeholder so the agent loop
      // remains testable offline.
      return `[on-device translate → ${language || "?"}] ${text}`;
    },
  };

  return [timeTool, calculatorTool, knowledgeSearch, knowledgeAdd, translate];
}

/** Tool lookup helper. */
export function findTool(tools: Tool[], name: string): Tool | undefined {
  return tools.find((t) => t.name === name);
}
