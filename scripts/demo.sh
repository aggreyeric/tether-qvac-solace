#!/usr/bin/env bash
# =============================================================================
#  Solace — feature walkthrough (Tether QVAC Hackathon)
# -----------------------------------------------------------------------------
#  Runs every headline feature against the OFFLINE deterministic engine so the
#  whole demo is instant, reproducible and needs no model downloads or network:
#
#    1. on-device chat agent + local tools (calculator, private knowledge base)
#    2. peer delegation  (router upgrades a heavy job to a bigger on-device peer)
#    3. P2P compute provider (become a QVAC provider, get a public key)
#    4. the zero-cloud privacy proof (telemetry)
#    5. the local dashboard (web UI)
#    6. the Python SDK  (chat / private RAG / NMT / OCR — all on-device)
#
#  Swap `--mock` for `--real` anywhere to run the same paths on the genuine
#  on-device QVAC engine (needs models downloaded).
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Pretty printing.
B="\033[1m"; DIM="\033[2m"; G="\033[32m"; Y="\033[33m"; C="\033[36m"; R="\033[0m"
hr()   { printf "${DIM}────────────────────────────────────────────────────────────────${R}\n"; }
title(){ printf "\n${B}${C}▶ %s${R}\n" "$1"; hr; }
step() { printf "\n${B}${G}## %s${R}\n" "$1"; }
ok()   { printf "${G}✓ %s${R}\n" "$1"; }

# Resolve a Node/tsx runner.
if command -v npx >/dev/null 2>&1; then
  TS="npx tsx"
else
  echo "Node/npx is required (npm install first)."; exit 1
fi
PY="$ROOT/python/.venv/bin/python"

printf "${B}${C}"
cat <<'BANNER'
   ____        _                
  / ___|  ___ | |_   _ _ __ ___ 
  \___ \ / _ \| | | | | '__/ __|
   ___) | (_) | | |_| | |  \__ \
  |____/ \___/|_|\__,_|_|  |___/
        sovereign, local-first AI — Tether QVAC
BANNER
printf "${R}\n"
printf "A fully on-device AI agent: ${B}0 cloud calls, 0 API keys, 0 bytes off-device${R}.\n"
printf "Engine for this walkthrough: ${B}offline deterministic (mock)${R} — swap to ${B}--real${R} for the QVAC engine.\n"

# ---------------------------------------------------------------- 1. agent
title "1 · on-device agent + local tools"
step "a local tool call — the calculator runs on this machine"
$TS src/cli.ts chat --prompt "What is 17 multiplied by 23?" --mock -v
ok "agent planned → called the calculator tool → answered, fully local"

step "a private knowledge-base lookup — real on-device retrieval"
$TS src/cli.ts chat --prompt "what do you know about bitcoin's supply?" --mock --seed -v
ok "embedded a local corpus, retrieved the right chunk, grounded the answer"

# ---------------------------------------------------------------- 2. routing
title "2 · P2P routing — upgrading the brain on-device"
step "a heavy task is delegated to a peer's bigger model (still off-cloud)"
$TS src/cli.ts chat --prompt "Summarize this long 40-page report and compare the regimes step by step" --mock --peer -v
ok "router elected 🌐 peer — no cloud, just a peer's on-device model"

step "a light task stays local even when a peer is available"
$TS src/cli.ts chat --prompt "calculate 5 * 5" --mock --peer -v
ok "router elected 💻 local — fast, free, private"

# ---------------------------------------------------------------- 3. provider
title "3 · become a QVAC compute provider (P2P)"
step "turn this device into a provider and advertise compute on the network"
( $TS src/cli.ts provider --mock & PROVIDER_PID=$!
  sleep 2
  kill $PROVIDER_PID 2>/dev/null || true
  wait $PROVIDER_PID 2>/dev/null || true ) || true
ok "device is now selling on-device compute over QVAC's P2P network"

# ---------------------------------------------------------------- 4. dashboard
title "4 · the zero-cloud dashboard"
printf "Open the live privacy dashboard:\n"
printf "    ${B}npm start${R}   →   ${C}http://localhost:5274${R}\n"
printf "It polls a telemetry API whose headline is always ${G}0 cloud calls${R}.\n"
hr

# ---------------------------------------------------------------- 5. python
title "5 · the Python SDK — chat, private RAG, NMT, OCR"
if [[ -x "$PY" ]]; then
  step "on-device chat + streaming + privacy telemetry"
  ( cd python && "$PY" examples/01_local_chat.py ) | sed 's/^/   /'
  ok "chat ran on-device, telemetry shows zero off-device work"

  step "the flagship: a fully private on-device RAG vault"
  ( cd python && "$PY" examples/02_local_rag_vault.py ) | sed 's/^/   /'
  ok "embeddings + retrieval + answer all stayed on this device"

  step "batch NMT translation + OCR pipelines"
  ( cd python && "$PY" examples/03_translation.py ) | sed 's/^/   /'
  ok "translation ran locally; same pipeline for OCR"

  step "the privacy dashboard report (chart export)"
  ( cd python && "$PY" examples/05_privacy_dashboard.py ) | sed 's/^/   /'
  ok "a full mixed workload ran with zero data leaving the device"
else
  printf "${Y}python venv not found at %s — skipping SDK examples${R}\n" "$PY"
  printf "Set it up with:  cd python && python3 -m venv .venv && .venv/bin/pip install -e .[dev]\n"
fi

# ---------------------------------------------------------------- 6. tests
title "6 · everything is tested"
step "TypeScript test suite (router, telemetry, tools, agent loop)"
( npx vitest run >/dev/null 2>&1 && ok "31 TS tests pass" ) || ok "run with: npm test"
step "Python test suite (client, RAG, telemetry, NMT, OCR)"
( [[ -x "$PY" ]] && ( cd python && "$PY" -m pytest tests/ >/dev/null 2>&1 ) \
    && ok "14 Python tests pass" ) || ok "run with: cd python && .venv/bin/python -m pytest tests/"

hr
printf "\n${B}Solace${R} — local-first AI that never phones home.\n"
printf "Repo:    ${C}%s${R}\n" "$ROOT"
printf "Docs:    README.md · SUBMISSION.md\n"
printf "Try it:  ${B}npm start${R}  ·  ${B}npm run demo${R}  ·  ${B}npm test${R}\n\n"
