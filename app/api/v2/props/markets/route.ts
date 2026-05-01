/**
 * /api/v2/props/markets — Available markets for sports
 *
 * Reads pre-computed `available_markets:{sport}` keys written by the EV worker.
 * One Redis GET per sport — no scanning, no index reads.
 *
 * Supports:
 *   ?sport=nba           — single sport (backwards compatible)
 *   ?sports=nba,nfl,nhl  — multi-sport, aggregated response
 */

export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getMarketDisplay } from "@/lib/odds/types";
import { resolveRedisCommandEndpoint } from "@/lib/redis-endpoints";

const commandEndpoint = resolveRedisCommandEndpoint();
if (!commandEndpoint.url || !commandEndpoint.token) {
  const reason = commandEndpoint.rejectedLoopback
    ? "loopback Redis URL rejected in production"
    : "missing Redis endpoint credentials";
  throw new Error(`[v2/props/markets] Redis endpoint configuration invalid: ${reason}`);
}

const redis = new Redis({
  url: commandEndpoint.url,
  token: commandEndpoint.token,
  responseEncoding: false,
});

const VALID_SPORTS = new Set([
  "nba", "nfl", "nhl", "mlb", "ncaabaseball",
  "ncaab", "ncaaf", "wnba",
  "soccer_epl", "soccer_laliga", "soccer_mls", "soccer_ucl", "soccer_uel",
  "tennis_atp", "tennis_challenger", "tennis_itf_men",
  "tennis_itf_women", "tennis_utr_men", "tennis_utr_women", "tennis_wta",
  "ufc",
]);

// Shape written by the worker at available_markets:{sport}
interface WorkerMarket {
  key: string;
  display: string;
  eventCount: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sportParam = searchParams.get("sport")?.trim().toLowerCase() || "";
    const sportsParam = searchParams.get("sports")?.trim().toLowerCase() || "";

    const startTime = performance.now();

    // ── Multi-sport mode ──────────────────────────────────────────────────
    if (sportsParam) {
      const requestedSports = sportsParam.split(",").filter(s => VALID_SPORTS.has(s));

      if (requestedSports.length === 0) {
        return NextResponse.json(
          { error: "invalid_sports", valid: Array.from(VALID_SPORTS) },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      // Single MGET for all sports — one round-trip
      const keys = requestedSports.map(s => `available_markets:${s}`);
      const rawResults = await redis.mget<(string | null)[]>(...keys);

      // Parse and aggregate
      const marketMap = new Map<string, { key: string; display: string; totalEvents: number; sports: string[] }>();

      requestedSports.forEach((sport, idx) => {
        const raw = rawResults[idx];
        if (!raw) return; // No data for this sport

        let markets: WorkerMarket[];
        try {
          markets = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
          return;
        }

        for (const market of markets) {
          const existing = marketMap.get(market.key);
          if (existing) {
            existing.totalEvents += market.eventCount;
            if (!existing.sports.includes(sport)) {
              existing.sports.push(sport);
            }
          } else {
            marketMap.set(market.key, {
              key: market.key,
              display: market.display || getMarketDisplay(market.key),
              totalEvents: market.eventCount,
              sports: [sport],
            });
          }
        }
      });

      const aggregatedMarkets = Array.from(marketMap.values())
        .sort((a, b) => b.totalEvents - a.totalEvents);

      const duration = performance.now() - startTime;

      if (process.env.NODE_ENV === "development") {
        console.log(`[v2/props/markets] ${requestedSports.join(",")}: ${aggregatedMarkets.length} markets in ${duration.toFixed(0)}ms`);
      }

      return NextResponse.json(
        {
          sports: requestedSports,
          markets: aggregatedMarkets,
          count: aggregatedMarkets.length,
          meta: { duration_ms: Math.round(duration) },
        },
        { headers: { "Cache-Control": "public, max-age=120, s-maxage=120" } }
      );
    }

    // ── Single sport mode (backwards compatible) ──────────────────────────
    if (!sportParam || !VALID_SPORTS.has(sportParam)) {
      return NextResponse.json(
        { error: "invalid_sport", valid: Array.from(VALID_SPORTS) },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const raw = await redis.get<string>(`available_markets:${sportParam}`);

    let markets: WorkerMarket[] = [];
    if (raw) {
      try {
        markets = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        markets = [];
      }
    }

    const duration = performance.now() - startTime;

    if (process.env.NODE_ENV === "development") {
      console.log(`[v2/props/markets] ${sportParam}: ${markets.length} markets in ${duration.toFixed(0)}ms`);
    }

    return NextResponse.json(
      {
        sport: sportParam,
        markets,
        count: markets.length,
        meta: { duration_ms: Math.round(duration) },
      },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } }
    );
  } catch (error: any) {
    console.error("[v2/props/markets] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}