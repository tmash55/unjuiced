export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getRedisCommandEndpoint, getRedisPubSubEndpoint } from "@/lib/redis-endpoints";

type CheckStatus = "ok" | "warn" | "error";

type CheckResult = {
  status: CheckStatus;
  latency_ms?: number;
  message?: string;
  details?: Record<string, unknown>;
};

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const VALID_SPORTS = new Set([
  "nba",
  "nfl",
  "nhl",
  "mlb",
  "ncaabaseball",
  "ncaab",
  "ncaaf",
  "wnba",
  "soccer_epl",
  "soccer_laliga",
  "soccer_mls",
  "soccer_ucl",
  "soccer_uel",
  "tennis_atp",
  "tennis_challenger",
  "tennis_itf_men",
  "tennis_itf_women",
  "tennis_utr_men",
  "tennis_utr_women",
  "tennis_wta",
  "ufc",
]);

function parseIntSafe(input: string | null, fallback: number): number {
  const n = Number(input ?? "");
  return Number.isFinite(n) ? n : fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

async function checkSubscribeEndpoint(
  endpoint: "subscribe" | "psubscribe",
  channel: string
): Promise<CheckResult> {
  const pubsub = getRedisPubSubEndpoint();
  const url = pubsub.url;
  const token = pubsub.token;

  if (!url || !token) {
    return {
      status: "error",
      message: "Missing Redis pub/sub endpoint configuration",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  const started = performance.now();

  try {
    const res = await fetch(`${url}/${endpoint}/${encodeURIComponent(channel)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      signal: controller.signal,
    });

    const latency = Math.round(performance.now() - started);
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    try {
      await res.body?.cancel();
    } catch {
      // no-op
    }

    if (!res.ok) {
      return {
        status: "error",
        latency_ms: latency,
        message: `${endpoint} returned ${res.status}`,
        details: { channel, content_type: contentType || null },
      };
    }

    if (!contentType.includes("text/event-stream")) {
      return {
        status: "warn",
        latency_ms: latency,
        message: `${endpoint} succeeded but content-type was not SSE`,
        details: { channel, content_type: contentType || null },
      };
    }

    return {
      status: "ok",
      latency_ms: latency,
      details: { channel, content_type: contentType },
    };
  } catch (error) {
    const latency = Math.round(performance.now() - started);
    return {
      status: "error",
      latency_ms: latency,
      message: error instanceof Error ? error.message : String(error),
      details: { channel },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const requestedSport = (sp.get("sport") || "nba").trim().toLowerCase();
  const sport = VALID_SPORTS.has(requestedSport) ? requestedSport : "nba";
  const sampleSize = Math.max(1, Math.min(50, parseIntSafe(sp.get("sample"), 10)));

  const checks: Record<string, CheckResult> = {};
  const summary = {
    critical_failures: 0,
    warnings: 0,
  };

  // 1) Core Redis command checks used by odds APIs.
  let activeEventIds: string[] = [];
  try {
    const started = performance.now();
    const members = await redis.smembers(`active_events:${sport}`);
    activeEventIds = members.map(String).filter(Boolean);
    checks.smembers_active_events = {
      status: "ok",
      latency_ms: Math.round(performance.now() - started),
      details: { sport, count: activeEventIds.length },
    };
  } catch (error) {
    checks.smembers_active_events = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    const started = performance.now();
    const mgetKeys = activeEventIds.slice(0, 5).map((eventId) => `events:${sport}:${eventId}`);
    if (mgetKeys.length === 0) {
      mgetKeys.push(`events:${sport}:__nonexistent__`);
    }
    const values = await redis.mget<Record<string, unknown>[]>(...mgetKeys);
    const found = values.filter((v) => !!v).length;
    checks.mget_events = {
      status: "ok",
      latency_ms: Math.round(performance.now() - started),
      details: { keys_checked: mgetKeys.length, found },
    };
  } catch (error) {
    checks.mget_events = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  let scannedEventIds: string[] = [];
  try {
    const started = performance.now();
    const [nextCursor, keys] = await redis.scan(0, {
      match: `events:${sport}:*`,
      count: 200,
    });
    scannedEventIds = keys
      .map((k) => {
        const prefix = `events:${sport}:`;
        return k.startsWith(prefix) ? k.slice(prefix.length) : "";
      })
      .filter(Boolean);

    checks.scan_events = {
      status: "ok",
      latency_ms: Math.round(performance.now() - started),
      details: {
        first_scan_count: keys.length,
        next_cursor: Number(nextCursor),
      },
    };
  } catch (error) {
    checks.scan_events = {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  // 2) Index coverage checks for the new consumer indexes.
  const candidateEventIds = Array.from(
    new Set([...activeEventIds, ...scannedEventIds].filter(Boolean))
  ).slice(0, sampleSize);

  if (candidateEventIds.length === 0) {
    checks.index_coverage = {
      status: "warn",
      message: "No sampled events available for index coverage check",
      details: { sport, sample_size: 0 },
    };
  } else {
    try {
      const started = performance.now();
      const counts = await Promise.all(
        candidateEventIds.map(async (eventId) => {
          const [oddsIdx, marketsIdx] = await Promise.all([
            redis.scard(`odds_idx:${sport}:${eventId}`),
            redis.scard(`markets_idx:${sport}:${eventId}`),
          ]);
          return {
            eventId,
            odds_idx_count: Number(oddsIdx || 0),
            markets_idx_count: Number(marketsIdx || 0),
          };
        })
      );

      const oddsPresent = counts.filter((c) => c.odds_idx_count > 0).length;
      const marketsPresent = counts.filter((c) => c.markets_idx_count > 0).length;
      const oddsCoverage = Math.round((oddsPresent / candidateEventIds.length) * 100);
      const marketsCoverage = Math.round((marketsPresent / candidateEventIds.length) * 100);
      const coverageStatus: CheckStatus =
        oddsCoverage >= 80 && marketsCoverage >= 80 ? "ok" : "warn";

      checks.index_coverage = {
        status: coverageStatus,
        latency_ms: Math.round(performance.now() - started),
        details: {
          sampled_events: candidateEventIds.length,
          odds_idx_coverage_pct: oddsCoverage,
          markets_idx_coverage_pct: marketsCoverage,
        },
      };
    } catch (error) {
      checks.index_coverage = {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // 3) Pub/Sub-over-SSE capability checks.
  const [subCheck, psubCheck] = await Promise.all([
    checkSubscribeEndpoint("subscribe", `odds_updates:${sport}`),
    checkSubscribeEndpoint("psubscribe", "odds_updates:*"),
  ]);
  checks.subscribe_sse = subCheck;
  checks.psubscribe_sse = psubCheck;

  // 4) Environment/meta checks.
  const envCheck: CheckResult = {
    status: "ok",
    details: (() => {
      const command = getRedisCommandEndpoint();
      const pubsub = getRedisPubSubEndpoint();
      return {
        has_url: Boolean(process.env.UPSTASH_REDIS_REST_URL),
        has_token: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
        has_command_url: Boolean(process.env.UPSTASH_REDIS_COMMAND_URL),
        has_command_token: Boolean(process.env.UPSTASH_REDIS_COMMAND_TOKEN),
        has_pubsub_url: Boolean(process.env.UPSTASH_REDIS_PUBSUB_URL),
        has_pubsub_token: Boolean(process.env.UPSTASH_REDIS_PUBSUB_TOKEN),
        pubsub_fallback_to_command: process.env.UPSTASH_REDIS_PUBSUB_FALLBACK_TO_COMMAND === "true",
        using_dedicated_command: command.usingDedicated,
        using_fallback_command: command.usedFallback,
        using_dedicated_pubsub: pubsub.usingDedicated,
        using_fallback_pubsub: pubsub.usedFallback,
        partial_pubsub_config: pubsub.partialDedicatedConfig,
        partial_command_config: command.partialDedicatedConfig,
        sport,
      };
    })(),
  };
  checks.environment = envCheck;

  for (const result of Object.values(checks)) {
    if (result.status === "error") summary.critical_failures += 1;
    if (result.status === "warn") summary.warnings += 1;
  }

  const overallStatusCode = summary.critical_failures > 0 ? 503 : 200;
  const overallState = summary.critical_failures > 0 ? "unhealthy" : summary.warnings > 0 ? "degraded" : "healthy";

  // Helpful high-level verdict for index parity with Upstash setup.
  const parityHints: string[] = [];
  const coverage = checks.index_coverage;
  if (coverage?.status === "warn" && isObject(coverage.details)) {
    const oddsPct = Number(coverage.details.odds_idx_coverage_pct ?? 0);
    const marketsPct = Number(coverage.details.markets_idx_coverage_pct ?? 0);
    if (oddsPct < 100 || marketsPct < 100) {
      parityHints.push("Consumer indexes are not fully populated yet; APIs may still use scan fallbacks.");
    }
  }
  if (checks.subscribe_sse?.status !== "ok" || checks.psubscribe_sse?.status !== "ok") {
    parityHints.push("Redis REST subscribe endpoints are not fully healthy; SSE live updates may degrade.");
  }

  return NextResponse.json(
    {
      status: overallState,
      timestamp: new Date().toISOString(),
      summary,
      sport,
      checks,
      hints: parityHints,
    },
    {
      status: overallStatusCode,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
