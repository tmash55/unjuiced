export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getMarketDisplay } from "@/lib/odds/types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const VALID_SPORTS = new Set([
  "nba", "nfl", "nhl", "mlb", "ncaab", "ncaaf", "wnba", "soccer_epl"
]);

const SCAN_COUNT = 1000;

/**
 * Scan all keys matching a pattern using SCAN
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const results: string[] = [];
  let cursor = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT,
    });
    cursor = Number(nextCursor);
    results.push(...keys);
  } while (cursor !== 0);

  return results;
}

/**
 * Get active event IDs for a sport
 */
async function getActiveEventIds(sport: string): Promise<string[]> {
  const key = `active_events:${sport}`;
  const members = await redis.smembers(key);
  return members.map(String);
}

/**
 * Discover available markets for a sport by scanning odds keys
 */
async function discoverMarkets(sport: string): Promise<{
  markets: Array<{
    key: string;
    display: string;
    eventCount: number;
  }>;
}> {
  // Get active events
  const eventIds = await getActiveEventIds(sport);
  if (eventIds.length === 0) {
    return { markets: [] };
  }

  // Scan for all odds keys
  const allOddsKeys = await scanKeys(`odds:${sport}:*`);
  if (allOddsKeys.length === 0) {
    return { markets: [] };
  }

  // Extract unique markets and count events per market
  const marketEventCounts = new Map<string, Set<string>>();
  const eventIdSet = new Set(eventIds);

  for (const key of allOddsKeys) {
    // Parse key: odds:sport:eventId:market:book
    const parts = key.split(":");
    if (parts.length < 5) continue;

    const eventId = parts[2];
    const market = parts[3];

    // Only count active events
    if (!eventIdSet.has(eventId)) continue;

    if (!marketEventCounts.has(market)) {
      marketEventCounts.set(market, new Set());
    }
    marketEventCounts.get(market)!.add(eventId);
  }

  // Build markets array
  const markets = Array.from(marketEventCounts.entries())
    .map(([key, events]) => ({
      key,
      display: getMarketDisplay(key),
      eventCount: events.size,
    }))
    .sort((a, b) => b.eventCount - a.eventCount); // Sort by event count

  return { markets };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get("sport")?.trim().toLowerCase() || "";

    // Validate sport
    if (!sport || !VALID_SPORTS.has(sport)) {
      return NextResponse.json(
        { error: "invalid_sport", valid: Array.from(VALID_SPORTS) },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const startTime = performance.now();

    const { markets } = await discoverMarkets(sport);

    const duration = performance.now() - startTime;

    if (process.env.NODE_ENV === "development") {
      console.log(`[v2/props/markets] ${sport}: ${markets.length} markets in ${duration.toFixed(0)}ms`);
    }

    return NextResponse.json(
      {
        sport,
        markets,
        count: markets.length,
        meta: {
          duration_ms: Math.round(duration),
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60", // Cache for 1 minute
        },
      }
    );
  } catch (error: any) {
    console.error("[v2/props/markets] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

