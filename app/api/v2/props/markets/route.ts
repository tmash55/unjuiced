export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getMarketDisplay } from "@/lib/odds/types";
import { getRedisCommandEndpoint } from "@/lib/redis-endpoints";

const commandEndpoint = getRedisCommandEndpoint();
const redis = new Redis({
  url: commandEndpoint.url || process.env.UPSTASH_REDIS_REST_URL!,
  token: commandEndpoint.token || process.env.UPSTASH_REDIS_REST_TOKEN!,
  responseEncoding: false,
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

const SCAN_COUNT = 1000;
const activeEventsCache = new Map<string, { ids: string[]; ts: number }>();
const ACTIVE_EVENTS_CACHE_TTL = 15000; // 15s

/**
 * Scan all keys matching a pattern using SCAN
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const results: string[] = [];
  let cursor = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 200;
  const seenCursors = new Set<number>();

  do {
    iterations++;
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT,
    });
    const next = Number(nextCursor);
    results.push(...keys.map(String));

    // Stop on terminal cursor.
    if (next === 0) {
      break;
    }

    // Defensive guard for malformed cursor responses.
    if (!Number.isFinite(next) || next < 0) {
      if (results.length > 0) {
        console.warn(`[v2/props/markets] Invalid cursor for ${pattern}, stopping at ${results.length} keys`);
      }
      break;
    }

    // Defensive guard for buggy/proxy scan behavior where cursor repeats forever.
    if (seenCursors.has(next)) {
      if (results.length > 0) {
        console.warn(`[v2/props/markets] Cursor cycle detected for ${pattern}, stopping at ${results.length} keys`);
      }
      break;
    }
    seenCursors.add(next);
    cursor = next;

    if (iterations >= MAX_ITERATIONS) {
      console.warn(`[v2/props/markets] Hit scan limit for ${pattern}, got ${results.length} keys`);
      break;
    }
  } while (true);

  return results;
}

/**
 * Get active event IDs for a sport
 */
async function getActiveEventIds(sport: string): Promise<string[]> {
  const cached = activeEventsCache.get(sport);
  if (cached && (Date.now() - cached.ts) < ACTIVE_EVENTS_CACHE_TTL) {
    return cached.ids;
  }

  const key = `active_events:${sport}`;
  const members = (await redis.smembers(key)).map(String).filter(Boolean);

  // Fast path: healthy active set.
  if (members.length > 8) {
    const unique = [...new Set(members)];
    activeEventsCache.set(sport, { ids: unique, ts: Date.now() });
    return unique;
  }

  // Fallback/merge when index set is partially populated.
  const eventKeys = await scanKeys(`events:${sport}:*`);
  const prefix = `events:${sport}:`;
  const scannedIds = eventKeys
    .map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : ""))
    .filter(Boolean);

  const merged = [...new Set([...members, ...scannedIds])];
  activeEventsCache.set(sport, { ids: merged, ts: Date.now() });
  return merged;
}

function addEventMarket(
  marketEventCounts: Map<string, Set<string>>,
  market: string,
  eventId: string
) {
  if (!market) return;
  if (!marketEventCounts.has(market)) {
    marketEventCounts.set(market, new Set());
  }
  marketEventCounts.get(market)!.add(eventId);
}

function parseOddsIndexMember(member: string): { market: string; book: string } | null {
  const sep = member.lastIndexOf(":");
  if (sep <= 0 || sep >= member.length - 1) return null;
  return {
    market: member.slice(0, sep),
    book: member.slice(sep + 1),
  };
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

  // Extract unique markets and count events per market
  const marketEventCounts = new Map<string, Set<string>>();
  const unresolvedEvents = new Set(eventIds);

  // 1) Preferred path: consumer-maintained markets index
  const IDX_BATCH = 20;
  for (let i = 0; i < eventIds.length; i += IDX_BATCH) {
    const batch = eventIds.slice(i, i + IDX_BATCH);
    const membersByEvent = await Promise.all(
      batch.map((eventId) => redis.smembers(`markets_idx:${sport}:${eventId}`))
    );

    batch.forEach((eventId, idx) => {
      const markets = (membersByEvent[idx] || []).map(String).filter(Boolean);
      if (markets.length === 0) return;
      unresolvedEvents.delete(eventId);
      for (const market of markets) {
        addEventMarket(marketEventCounts, market, eventId);
      }
    });
  }

  // 2) Fallback: parse market from odds_idx members ("{market}:{book}")
  if (unresolvedEvents.size > 0) {
    const unresolvedList = Array.from(unresolvedEvents);
    for (let i = 0; i < unresolvedList.length; i += IDX_BATCH) {
      const batch = unresolvedList.slice(i, i + IDX_BATCH);
      const membersByEvent = await Promise.all(
        batch.map((eventId) => redis.smembers(`odds_idx:${sport}:${eventId}`))
      );

      batch.forEach((eventId, idx) => {
        const members = (membersByEvent[idx] || []).map(String);
        let foundAny = false;
        for (const member of members) {
          const parsed = parseOddsIndexMember(member);
          if (!parsed?.market) continue;
          foundAny = true;
          addEventMarket(marketEventCounts, parsed.market, eventId);
        }
        if (foundAny) {
          unresolvedEvents.delete(eventId);
        }
      });
    }
  }

  // 3) Final fallback: event-scoped scan only for unresolved events
  if (unresolvedEvents.size > 0) {
    const scanTargets = Array.from(unresolvedEvents);
    const SCAN_BATCH = 10;
    for (let i = 0; i < scanTargets.length; i += SCAN_BATCH) {
      const batch = scanTargets.slice(i, i + SCAN_BATCH);
      const results = await Promise.all(
        batch.map((eventId) => scanKeys(`odds:${sport}:${eventId}:*`))
      );

      batch.forEach((eventId, idx) => {
        const keys = results[idx];
        for (const key of keys) {
          const parts = key.split(":");
          if (parts.length < 5) continue;
          const market = parts[3];
          addEventMarket(marketEventCounts, market, eventId);
        }
      });
    }
  }

  if (marketEventCounts.size === 0) {
    return { markets: [] };
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
    const sportParam = searchParams.get("sport")?.trim().toLowerCase() || "";
    const sportsParam = searchParams.get("sports")?.trim().toLowerCase() || "";

    const startTime = performance.now();

    // Support fetching multiple sports at once (comma-separated)
    // e.g., /api/v2/props/markets?sports=nba,nfl,nhl
    if (sportsParam) {
      const requestedSports = sportsParam.split(",").filter(s => VALID_SPORTS.has(s));
      
      if (requestedSports.length === 0) {
        return NextResponse.json(
          { error: "invalid_sports", valid: Array.from(VALID_SPORTS) },
          { status: 400, headers: { "Cache-Control": "no-store" } }
        );
      }

      // Fetch all sports in parallel
      const results = await Promise.all(
        requestedSports.map(async (sport) => {
          const { markets } = await discoverMarkets(sport);
          return { sport, markets };
        })
      );

      // Aggregate markets across all sports
      const marketMap = new Map<string, { key: string; display: string; totalEvents: number; sports: string[] }>();

      for (const { sport, markets } of results) {
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
              display: market.display,
              totalEvents: market.eventCount,
              sports: [sport],
            });
          }
        }
      }

      // Convert to array and sort by total events
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
          meta: {
            duration_ms: Math.round(duration),
          },
        },
        {
          headers: {
            "Cache-Control": "public, max-age=120, s-maxage=120", // Cache for 2 minutes
          },
        }
      );
    }

    // Single sport mode (backwards compatible)
    if (!sportParam || !VALID_SPORTS.has(sportParam)) {
      return NextResponse.json(
        { error: "invalid_sport", valid: Array.from(VALID_SPORTS) },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { markets } = await discoverMarkets(sportParam);

    const duration = performance.now() - startTime;

    if (process.env.NODE_ENV === "development") {
      console.log(`[v2/props/markets] ${sportParam}: ${markets.length} markets in ${duration.toFixed(0)}ms`);
    }

    return NextResponse.json(
      {
        sport: sportParam,
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
