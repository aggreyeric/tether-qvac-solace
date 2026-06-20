#!/usr/bin/env node
/**
 * Solace — local dashboard server.
 *
 * A zero-dependency HTTP server (`node:http`) that exposes the agent + telemetry
 * over a tiny API and renders a single-page dashboard proving the zero-cloud
 * guarantee. Everything runs on-device: the dashboard itself is served from the
 * same process that runs the local model.
 *
 *   GET  /                 — the dashboard (HTML)
 *   GET  /api/telemetry    — JSON telemetry snapshot (the privacy proof)
 *   GET  /api/models       — the local model registry
 *   POST /api/ask          — { prompt } -> { answer, steps, usedPeer, telemetry }
 *
 *   tsx src/server.ts [--mock|--real] [--port 5274] [--seed]
 *
 * (c) 2026 — built for the Tether QVAC Hackathon. Apache-2.0.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SolaceAgent } from "./agent.js";
import { MockQvacClient } from "./qvac-mock.js";
import { createRealQvacClient } from "./qvac-real.js";
import { telemetry } from "./telemetry.js";
import { DEFAULT_EMBEDDING, DEFAULT_LLM, MODELS, describeModel } from "./models.js";
import type { QvacClient } from "./types.js";

interface ServerArgs {
  useMock: boolean;
  port: number;
  seed: boolean;
}

function parseArgs(argv: string[]): ServerArgs {
  const args = argv.slice(2);
  const portIdx = args.findIndex((a) => a === "--port");
  const port = portIdx >= 0 ? Number(args[portIdx + 1]) : 5274;
  return {
    useMock: !args.includes("--real"),
    port: Number.isFinite(port) ? port : 5274,
    seed: args.includes("--seed"),
  };
}

const DEMO_CORPUS = [
  "Bitcoin has a fixed supply of 21 million coins, created by Satoshi Nakamoto in 2009. The block reward halves roughly every four years in an event called the halving.",
  "Ethereum is a programmable blockchain with smart contracts. It moved from proof-of-work to proof-of-stake in the 2022 Merge, cutting its energy use by about 99.95%.",
  "Stablecoins like USDt track the US dollar and are used as a low-volatility settlement asset in crypto markets.",
];

function dashboardHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Solace — sovereign local AI</title>
<style>
  :root{--bg:#0b0f17;--panel:#121a2b;--ink:#e6edf7;--mut:#8aa0bd;--acc:#3ddc97;--peer:#f5a623;--bad:#ff6b6b}
  *{box-sizing:border-box}body{margin:0;font:15px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--bg);color:var(--ink)}
  header{padding:28px 32px 8px;border-bottom:1px solid #1d2740}h1{margin:0;font-size:22px}header p{margin:4px 0 0;color:var(--mut)}
  main{max-width:920px;margin:0 auto;padding:24px 16px 64px}
  .grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:16px 0}
  .card{background:var(--panel);border:1px solid #1d2740;border-radius:12px;padding:16px}
  .card .k{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  .card .v{font-size:26px;font-weight:700;margin-top:4px}
  .card.cloud .v{color:var(--acc)}
  .bar{height:6px;border-radius:6px;background:#1d2740;margin-top:8px;overflow:hidden}
  .bar i{display:block;height:100%;width:0;background:var(--acc);transition:width .4s}
  form{display:flex;gap:8px;margin:18px 0}
  input{flex:1;background:var(--panel);border:1px solid #1d2740;color:var(--ink);border-radius:10px;padding:12px 14px;font:inherit}
  button{background:var(--acc);color:#06241a;border:0;border-radius:10px;padding:0 18px;font:inherit;font-weight:700;cursor:pointer}
  button:disabled{opacity:.5;cursor:wait}
  .answer{background:var(--panel);border:1px solid #1d2740;border-radius:12px;padding:16px;white-space:pre-wrap}
  .log{color:var(--mut);font-size:13px;margin-top:10px}
  .log b{color:var(--ink)}a{color:var(--acc)}footer{color:var(--mut);font-size:12px;text-align:center;padding:24px}
</style></head><body>
<header><h1>🔒 Solace — sovereign, local-first AI</h1>
<p>Built on the Tether QVAC SDK. Your data never leaves this device.</p></header>
<main>
  <div class="grid">
    <div class="card cloud"><div class="k">Cloud calls</div><div class="v" id="cloud">0</div><div class="bar"><i id="cloudBar"></i></div></div>
    <div class="card"><div class="k">Local calls</div><div class="v" id="local">0</div></div>
    <div class="card"><div class="k">Peer calls</div><div class="v" id="peer">0</div></div>
    <div class="card"><div class="k">Tokens on-device</div><div class="v" id="tokens">0</div></div>
  </div>
  <p id="headline" style="color:var(--mut)"></p>
  <form id="f"><input id="q" placeholder="Ask Solace anything (e.g. ‘what is 17 * 23?’)…" autocomplete="off"/>
  <button id="b">Run</button></form>
  <div id="answer" class="answer" style="display:none"></div>
  <div id="log" class="log"></div>
</main>
<footer>Solace · Tether QVAC Hackathon · 100% on-device</footer>
<script>
const $=id=>document.getElementById(id);
async function poll(){const r=await fetch('/api/telemetry').then(r=>r.json());
  $('cloud').textContent=r.cloudCalls;$('local').textContent=r.localCalls;$('peer').textContent=r.peerCalls;
  $('tokens').textContent=r.totalTokens;$('headline').textContent=r.headline;
  const tot=Math.max(1,r.totalCalls);$('cloudBar').style.width=(100*r.cloudCalls/tot)+'%';}
poll();setInterval(poll,1500);
$('f').onsubmit=async e=>{e.preventDefault();const q=$('q').value.trim();if(!q)return;
  $('b').disabled=true;$('answer').style.display='block';$('answer').textContent='thinking on-device…';$('log').textContent='';
  try{const r=await fetch('/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:q})}).then(r=>r.json());
    $('answer').textContent=r.answer;
    $('log').innerHTML=r.steps.map(function(s){var tc=s.toolCalls.length?s.toolCalls.map(function(t){return '&#128295; '+t.name}).join(', '):'final answer';return '<b>step '+(s.step+1)+'</b> ['+s.site+'] '+tc}).join('<br>');
  }catch(err){$('answer').textContent='error: '+err}finally{$('b').disabled=false;poll();}};
</script></body></html>`;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const client: QvacClient = args.useMock
    ? new MockQvacClient({ workspace: "solace" })
    : await createRealQvacClient({ workspace: "solace" });

  const llm = await client.loadModel({ modelSrc: MODELS[DEFAULT_LLM], role: "llm" } as never);
  const embed = await client.loadModel({ modelSrc: MODELS[DEFAULT_EMBEDDING], role: "embedding" } as never);
  if (args.seed && client.ragIngest) {
    await client.ragIngest({ modelId: embed, documents: DEMO_CORPUS, workspace: "solace" });
  }

  const buildAgent = () =>
    new SolaceAgent({ client, modelId: llm, embeddingModelId: embed, workspace: "solace", peerAvailable: true });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${args.port}`);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(dashboardHtml());
      } else if (req.method === "GET" && url.pathname === "/api/telemetry") {
        json(res, 200, telemetry.snapshot());
      } else if (req.method === "GET" && url.pathname === "/api/models") {
        json(res, 200, Object.fromEntries(Object.entries(MODELS).map(([k]) => [k, describeModel(k as never)])));
      } else if (req.method === "POST" && url.pathname === "/api/ask") {
        const body = await readJson(req);
        const prompt = String(body.prompt ?? "").trim();
        if (!prompt) return json(res, 400, { error: "missing 'prompt'" });
        const result = await buildAgent().run(prompt);
        json(res, 200, { ...result, telemetry: telemetry.snapshot() });
      } else {
        json(res, 404, { error: "not found" });
      }
    } catch (err) {
      json(res, 500, { error: (err as Error).message });
    }
  });

  server.listen(args.port, () => {
    console.log(`🔒 Solace dashboard → http://localhost:${args.port}`);
    console.log(`   engine: ${client.mode === "mock" ? "offline deterministic (mock)" : "real QVAC on-device"} · seed: ${args.seed}`);
  });
}

main();
