/**
 * Solace — telemetry: the zero-cloud audit trail.
 *
 * Every inference in Solace is accounted for here. The headline invariant is
 * `cloudCalls === 0`: Solace never calls a cloud API, ever. When a job runs
 * locally it is `local`; when it is delegated to a peer over QVAC's P2P network
 * it is `peer`. Both are "off-cloud".
 *
 * The agent, router and server all funnel events into a single Telemetry instance
 * so the demo dashboard can render a single source of truth.
 */

import type { CompletionStats, InferenceSite } from "./types.js";

export interface TelemetryEvent {
  /** Monotonic counter. */
  seq: number;
  /** Wall-clock time (ms since the client started). */
  at: number;
  site: InferenceSite;
  /** Why it ran here (from the router) or what it was (e.g. "rag.search"). */
  label: string;
  tokens?: number;
  ms?: number;
}

export interface TelemetrySnapshot {
  startedAt: number;
  uptimeMs: number;
  localCalls: number;
  peerCalls: number;
  cloudCalls: number;
  /** localCalls + peerCalls. */
  offCloudCalls: number;
  totalCalls: number;
  totalTokens: number;
  events: TelemetryEvent[];
  /** Human-readable headline for the dashboard. */
  headline: string;
}

export class Telemetry {
  private readonly startedAt = Date.now();
  private readonly events: TelemetryEvent[] = [];
  private seq = 0;

  /** Record one inference and return the event. */
  record(site: InferenceSite, label: string, extra?: { tokens?: number; ms?: number }): TelemetryEvent {
    const evt: TelemetryEvent = {
      seq: this.seq++,
      at: Date.now() - this.startedAt,
      site,
      label,
      ...extra,
    };
    this.events.push(evt);
    return evt;
  }

  /** Convenience: record a completion using its stats. */
  recordCompletion(site: InferenceSite, label: string, stats?: CompletionStats, ms?: number): TelemetryEvent {
    return this.record(site, label, {
      tokens: stats?.generatedTokens,
      ms,
    });
  }

  private count(site: InferenceSite): number {
    return this.events.filter((e) => e.site === site).length;
  }

  get totalTokens(): number {
    return this.events.reduce((sum, e) => sum + (e.tokens ?? 0), 0);
  }

  snapshot(): TelemetrySnapshot {
    const localCalls = this.count("local");
    const peerCalls = this.count("peer");
    const cloudCalls = this.count("cloud");
    return {
      startedAt: this.startedAt,
      uptimeMs: Date.now() - this.startedAt,
      localCalls,
      peerCalls,
      cloudCalls,
      offCloudCalls: localCalls + peerCalls,
      totalCalls: localCalls + peerCalls + cloudCalls,
      totalTokens: this.totalTokens,
      events: [...this.events],
      headline:
        cloudCalls === 0
          ? `🔒 0 cloud calls · ${localCalls} local · ${peerCalls} peer · ${this.totalTokens} tokens on-device`
          : `⚠️ ${cloudCalls} cloud call(s) detected — privacy compromised`,
    };
  }

  /** Reset (mainly for tests). */
  reset(): void {
    this.events.length = 0;
    this.seq = 0;
  }
}

/** A process-wide telemetry singleton, usable from any module. */
export const telemetry = new Telemetry();
