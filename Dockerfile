# =============================================================================
#  Solace — Docker image (Tether QVAC Hackathon)
# -----------------------------------------------------------------------------
#  Runs the local-first dashboard by default in OFFLINE deterministic mode, so
#  the container works on any machine with no model downloads and no network.
#  To use the real on-device QVAC engine inside the container, run:
#      docker compose run --rm solace node dist/src/cli.js chat --real
#  (the @qvac/sdk native packages are installed as an optional dependency).
# =============================================================================
FROM node:22-bookworm-slim AS base

# Build tools so any native optional dependency (@qvac/sdk C++ addons) can
# compile if no prebuilt binary is shipped for this arch.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci --include=optional --no-audit --no-fund || npm install --no-audit --no-fund

# Bring in the source and compile TypeScript -> dist/.
COPY tsconfig.json vitest.config.ts ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Non-root user for the running process.
RUN useradd --create-home --uid 1001 solace && chown -R solace:solace /app
USER solace

ENV NODE_ENV=production
ENV SOLACE_MODE=mock
EXPOSE 5274

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5274/api/telemetry').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Default: the zero-cloud dashboard on the offline engine.
CMD ["node", "dist/src/server.js", "--mock", "--seed", "--port", "5274"]
