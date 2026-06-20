#!/usr/bin/env node
/**
 * Solace — command-line interface.
 *
 *   solace chat [--prompt "..."] [--mock|--real] [--peer] [--local] [--seed]
 *   solace provider [--mock|--real]
 *   solace --help
 *
 * `chat` (the default) runs the on-device agent: it routes each task between
 * the local model and a peer, uses local tools (calculator, private knowledge
 * base, translation), and prints the zero-cloud telemetry proof at the end.
 * `provider` turns this machine into a QVAC compute provider on the P2P network.
 *
 * (c) 2026 — built for the Tether QVAC Hackathon. Apache-2.0.
 */

import { createInterface } from "node:readline";
import { SolaceAgent, type AgentEvent } from "./agent.js";
import { MockQvacClient } from "./qvac-mock.js";
import { createRealQvacClient } from "./qvac-real.js";
import { telemetry } from "./telemetry.js";
import {
  DEFAULT_EMBEDDING,
  DEFAULT_LLM,
  MODELS,
  describeModel,
  type ModelKey,
} from "./models.js";
import type { QvacClient } from "./types.js";
import { formatDecision } from "./router.js";

interface CliArgs {
  command: string;
  useMock: boolean;
  peer: boolean;
  forceLocal: boolean;
  forcePeer: boolean;
  seed: boolean;
  prompt?: string;
  workspace: string;
  verbose: boolean;
}

const DEMO_CORPUS = [
  "Bitcoin has a fixed supply of 21 million coins, created by Satoshi Nakamoto in 2009. The block reward halves roughly every four years in an event called the halving.",
  "Ethereum is a programmable blockchain with smart contracts. It moved from proof-of-work to proof-of-stake in the 2022 Merge, cutting its energy use by about 99.95%.",
  "Stablecoins like USDt track the US dollar and are used as a low-volatility settlement asset in crypto markets and increasingly for real-world payments.",
  "The Fear & Greed Index aggregates sentiment, volatility, momentum and social signals into a 0-100 score. Below 25 means Extreme Fear; above 75 means Extreme Greed.",
];

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let command = "chat";
  if (args.length > 0 && !args[0].startsWith("-")) {
    command = args.shift()!;
  }
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const promptIdx = args.findIndex((a) => a === "--prompt" || a === "-p");
  let prompt: string | undefined;
  if (promptIdx >= 0) {
    prompt = args[promptIdx + 1];
  } else {
    // positional prompt after the command
    const positional = args.filter((a) => !a.startsWith("-"));
    if (positional.length > 0) prompt = positional.join(" ");
  }
  return {
    command,
    useMock: !flags.has("--real"),
    peer: flags.has("--peer"),
    forceLocal: flags.has("--local"),
    forcePeer: flags.has("--peer-only"),
    seed: flags.has("--seed"),
    prompt,
    workspace: "solace",
    verbose: flags.has("--verbose") || flags.has("-v"),
  };
}

function help(): void {
  console.log(`
Solace — a sovereign, local-first AI agent (Tether QVAC).

USAGE
  solace chat [options]            Run the on-device agent (default command).
  solace provider [options]        Become a QVAC P2P compute provider.
  solace --help                    Show this help.

CHAT OPTIONS
  --prompt, -p "<text>"            Run one task and exit (no REPL).
  --mock                           Use the offline deterministic engine (default).
  --real                           Use the real on-device QVAC engine.
  --peer                           Allow the router to delegate to a peer.
  --local                          Force every completion to run locally.
  --seed                           Pre-load a small demo knowledge base.
  --workspace <name>               Local RAG workspace name (default: solace).
  -v, --verbose                    Print each routing decision.

EXAMPLES
  npm run agent -- --mock --seed
  npm run cli -- chat --prompt "What is 17 * 23?" --mock
  npm run cli -- chat --prompt "Summarize this long report" --mock --peer
  npm run provider
`);
}

async function buildClient(args: CliArgs): Promise<QvacClient> {
  if (args.useMock) {
    return new MockQvacClient({ workspace: args.workspace, peerConnected: args.peer });
  }
  return createRealQvacClient({ workspace: args.workspace });
}

async function loadBrains(client: QvacClient): Promise<{ llm: string; embed: string }> {
  const llm = await client.loadModel({
    modelSrc: MODELS[DEFAULT_LLM],
    role: "llm",
  } as never);
  const embed = await client.loadModel({
    modelSrc: MODELS[DEFAULT_EMBEDDING],
    role: "embedding",
  } as never);
  return { llm, embed };
}

function makeOnEvent(verbose: boolean): (e: AgentEvent) => void {
  return (e) => {
    if (!verbose) return;
    if (e.type === "route") {
      console.log(`  ${formatDecision({ target: e.site === "peer" ? "peer" : "local", reason: e.reason })}`);
    } else if (e.type === "tool") {
      const r = e.result.length > 60 ? `${e.result.slice(0, 59)}…` : e.result;
      console.log(`  🔧 ${e.name}() → ${r}`);
    }
  };
}

async function maybeSeed(client: QvacClient, embedModelId: string, workspace: string): Promise<void> {
  if (!client.ragIngest) return;
  const res = await client.ragIngest({ modelId: embedModelId, documents: DEMO_CORPUS, workspace });
  console.log(`📚 seeded private knowledge base (${res.ingested} chunks) — search with "what do you know about bitcoin?"`);
}

async function runChat(args: CliArgs): Promise<void> {
  const client = await buildClient(args);
  console.log(`🧠 Solace agent — engine: ${client.mode === "mock" ? "offline deterministic (mock)" : "real QVAC on-device"}`);
  console.log(`   brain: ${describeModel(DEFAULT_LLM as ModelKey)}`);
  console.log(`   embeddings: ${describeModel(DEFAULT_EMBEDDING as ModelKey)}`);
  console.log("");

  const { llm, embed } = await loadBrains(client);
  if (args.seed) await maybeSeed(client, embed, args.workspace);

  const forceTarget = args.forceLocal ? "local" : args.forcePeer ? "peer" : undefined;
  const buildAgent = () =>
    new SolaceAgent({
      client,
      modelId: llm,
      embeddingModelId: embed,
      workspace: args.workspace,
      peerAvailable: args.peer,
      forceTarget,
      onEvent: makeOnEvent(args.verbose),
    });

  const askOnce = async (prompt: string): Promise<void> => {
    const result = await buildAgent().run(prompt);
    console.log(`\n🭯 ${result.answer}\n`);
    console.log(`   (steps: ${result.steps.length} · peer used: ${result.usedPeer ? "yes" : "no"} · cloud calls: ${result.cloudCalls})`);
  };

  if (args.prompt) {
    await askOnce(args.prompt);
  } else {
    console.log("Interactive mode — type a task, or 'exit' to quit.\n");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    for await (const line of rl) {
      const text = line.trim();
      if (!text) continue;
      if (text === "exit" || text === "quit") break;
      try {
        await askOnce(text);
      } catch (err) {
        console.error(`error: ${(err as Error).message}`);
      }
    }
  }

  console.log(`\n${telemetry.snapshot().headline}`);
  await client.close();
}

async function runProvider(args: CliArgs): Promise<void> {
  const client = await buildClient(args);
  console.log("🌐 Starting QVAC P2P compute provider…");
  if (!client.startProvider) {
    console.error("this client cannot become a provider");
    await client.close();
    return;
  }
  const { publicKey } = await client.startProvider();
  console.log(`✅ Providing on-device compute on the QVAC P2P network.`);
  console.log(`   peer public key: ${publicKey}`);
  console.log(`   engine: ${client.mode === "mock" ? "offline deterministic (mock)" : "real QVAC on-device"}`);
  console.log("   (Ctrl+C to stop)\n");
  // Keep the process alive so the peer stays discoverable.
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => resolve());
  });
  await client.stopProvider?.();
  console.log(`\n${telemetry.snapshot().headline}`);
  await client.close();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (args.command === "--help" || args.command === "help" || process.argv.includes("--help")) {
    help();
    return;
  }
  try {
    if (args.command === "provider") await runProvider(args);
    else if (args.command === "chat") await runChat(args);
    else {
      help();
    }
  } catch (err) {
    console.error(`\n❌ ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

main();
