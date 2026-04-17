import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import { supabaseBreaker, redisBreaker } from "@/lib/circuit-breaker";

type CheckStatus = "ok" | "degraded" | "error";

type CheckResult = {
  status: CheckStatus;
  latency_ms?: number;
  message?: string;
  [key: string]: unknown;
};

export async function GET() {
  const checks: Record<string, CheckResult> = {};
  let critical = false;

  const etFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = etFormatter.format(new Date());

  // 1. Redis connectivity
  const redisStart = Date.now();
  try {
    await redisBreaker.call(() => redis.set("health:ping", "1", { ex: 10 }));
    checks.redis = {
      status: "ok",
      latency_ms: Date.now() - redisStart,
      circuit: redisBreaker.status(),
    };
  } catch (err) {
    checks.redis = {
      status: "error",
      message: String(err),
      circuit: redisBreaker.status(),
    };
    critical = true;
  }

  // 2. Supabase connectivity
  const sbStart = Date.now();
  try {
    const supabase = createServerSupabaseClient();
    const result = await supabaseBreaker.call(async () =>
      supabase.from("mlb_games").select("game_id").limit(1),
    );
    if (result.error) throw new Error(result.error.message);
    checks.supabase = {
      status: "ok",
      latency_ms: Date.now() - sbStart,
      circuit: supabaseBreaker.status(),
    };
  } catch (err) {
    checks.supabase = {
      status: "error",
      message: String(err),
      circuit: supabaseBreaker.status(),
    };
    critical = true;
  }

  // 3. Poller heartbeat — check how recently the MLB live poller wrote to Supabase
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from("mlb_games")
      .select("live_feed_updated_at")
      .not("live_feed_updated_at", "is", null)
      .order("live_feed_updated_at", { ascending: false })
      .limit(1);

    if (data?.[0]?.live_feed_updated_at) {
      const lastUpdate = new Date(data[0].live_feed_updated_at);
      const ageMs = Date.now() - lastUpdate.getTime();
      // Flag as degraded if poller hasn't written in > 2 minutes
      checks.poller = {
        status: ageMs > 120_000 ? "degraded" : "ok",
        last_update: data[0].live_feed_updated_at,
        age_seconds: Math.round(ageMs / 1000),
      };
    } else {
      checks.poller = { status: "degraded", message: "No live feed updates found" };
    }
  } catch (err) {
    checks.poller = { status: "error", message: String(err) };
  }

  // 4. Cache age — inspect the split static + live caches
  try {
    const liveKey = `mlb:games:live:${today}`;
    const staticKey = `mlb:games:static:${today}`;

    const [liveCache, staticCache] = await Promise.all([
      redis.get<{ ts: number; anyLive?: boolean }>(liveKey).catch(() => null),
      redis.get<{ ts: number }>(staticKey).catch(() => null),
    ]);

    let cacheStatus: CheckStatus = "error";
    if (liveCache) cacheStatus = "ok";
    else if (staticCache) cacheStatus = "degraded";

    checks.cache = {
      status: cacheStatus,
      live_cache_age_seconds: liveCache?.ts
        ? Math.round((Date.now() - liveCache.ts) / 1000)
        : null,
      static_cache_age_seconds: staticCache?.ts
        ? Math.round((Date.now() - staticCache.ts) / 1000)
        : null,
      any_live: liveCache?.anyLive ?? null,
    };
  } catch (err) {
    checks.cache = { status: "error", message: String(err) };
  }

  // 5. Memory usage
  if (typeof process !== "undefined" && process.memoryUsage) {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const usagePct = Math.round((heapUsedMB / heapTotalMB) * 100);
    checks.memory = {
      status: usagePct > 90 ? "error" : "ok",
      heap_used_mb: heapUsedMB,
      heap_total_mb: heapTotalMB,
      usage_pct: usagePct,
    };
    if (usagePct > 90) critical = true;
  }

  return NextResponse.json(
    {
      status: critical ? "unhealthy" : "healthy",
      timestamp: new Date().toISOString(),
      uptime_seconds: typeof process !== "undefined" ? Math.round(process.uptime()) : null,
      checks,
    },
    { status: critical ? 503 : 200 },
  );
}
