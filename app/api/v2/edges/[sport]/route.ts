/**
 * Edge Finder API v2 - SSE-Powered
 * 
 * Finds +EV opportunities by comparing odds across all sportsbooks.
 * Uses Redis data populated by SSE consumer.
 * 
 * GET /api/v2/edges/nba?market=player_points&min_edge=0&compare=pinnacle&limit=50
 */

import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  SSEEvent,
  SSEBookSelections,
  BookPrice,
  EdgeResult,
  EdgeFinderResponse,
  getActiveEventsKey,
  getEventKey,
  getMarketDisplay,
} from "@/lib/odds/types";

// Supported sports for this endpoint
const SUPPORTED_SPORTS = new Set([
  "nba",
  "nfl",
  "mlb",
  "ncaabaseball",
  "nhl",
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

// Sharp books for comparison (in priority order)
const SHARP_BOOKS = ["pinnacle", "circa"];
const SCAN_COUNT = 1000;
const MAX_SCAN_ITERATIONS = 200;
const ACTIVE_EVENTS_CACHE_TTL = 15000;
const ENABLE_ODDS_SCAN_FALLBACK = process.env.ENABLE_ODDS_SCAN_FALLBACK === "true";
const activeEventsCache = new Map<string, { ids: string[]; ts: number }>();

const KNOWN_BOOKS = [
  "draftkings", "fanduel", "fanduelyourway", "betmgm", "caesars", "pointsbet", "bet365",
  "pinnacle", "circa", "hard-rock", "bally-bet", "betrivers", "unibet",
  "wynnbet", "espnbet", "fanatics", "betparx", "thescore", "prophetx",
  "superbook", "si-sportsbook", "betfred", "tipico", "fliff",
  "betmgm-michigan", "hardrock", "ballybet", "bally_bet", "bet-rivers", "bet_rivers"
];

function normalizeBookId(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock":
      return "hard-rock";
    case "hardrockindiana":
    case "hardrock-indiana":
      return "hard-rock-indiana";
    case "ballybet":
    case "bally_bet":
      return "bally-bet";
    case "bet-rivers":
    case "bet_rivers":
      return "betrivers";
    case "sportsinteraction":
      return "sports-interaction";
    case "fanduel-yourway":
    case "fanduel_yourway":
      return "fanduelyourway";
    case "betmgm-michigan":
    case "betmgm_michigan":
      return "betmgm";
    default:
      return lower;
  }
}

function getBookKeyCandidates(rawBook: string): string[] {
  const lower = rawBook.toLowerCase();
  const candidates = new Set<string>([lower]);
  const normalized = normalizeBookId(lower);
  candidates.add(normalized);
  candidates.add(lower.replace(/-/g, "_"));
  candidates.add(lower.replace(/_/g, "-"));
  candidates.add(normalized.replace(/-/g, "_"));
  candidates.add(normalized.replace(/_/g, "-"));

  if (normalized === "bally-bet") {
    candidates.add("ballybet");
    candidates.add("bally_bet");
  }
  if (normalized === "betrivers") {
    candidates.add("bet-rivers");
    candidates.add("bet_rivers");
  }
  if (normalized === "hard-rock") {
    candidates.add("hardrock");
  }

  return [...candidates].filter(Boolean);
}

function parseOddsIndexMember(member: string): { market: string; book: string } | null {
  const sep = member.lastIndexOf(":");
  if (sep <= 0 || sep >= member.length - 1) return null;
  return { market: member.slice(0, sep), book: member.slice(sep + 1) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sport: string }> }
) {
  try {
    const { sport } = await params;
    
    // Validate sport
    if (!SUPPORTED_SPORTS.has(sport.toLowerCase())) {
      return NextResponse.json(
        { error: "Unsupported sport", supported: Array.from(SUPPORTED_SPORTS) },
        { status: 400 }
      );
    }

    const sportKey = sport.toLowerCase();
    const url = new URL(request.url);

    // Parse query params
    const market = url.searchParams.get("market") || "player_points";
    const minEdge = parseFloat(url.searchParams.get("min_edge") || "0");
    const compareBook = url.searchParams.get("compare") || "pinnacle"; // pinnacle, circa, average
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const side = url.searchParams.get("side") as "over" | "under" | null; // Filter by side

    // 1. Get all active events
    const eventIds = await getActiveEventIds(sportKey);

    if (eventIds.length === 0) {
      return NextResponse.json({
        edges: [],
        count: 0,
        total_found: 0,
        market,
        compare_book: compareBook,
        min_edge: minEdge,
      } as EdgeFinderResponse);
    }

    // 2. Fetch event metadata (parallel)
    const eventKeys = eventIds.map((id) => getEventKey(sportKey, id));
    const eventDataRaw = await redis.mget<(string | SSEEvent | null)[]>(...eventKeys);

    const events: Record<string, SSEEvent> = {};
    eventIds.forEach((id, i) => {
      const data = eventDataRaw[i];
      if (data) {
        // Handle both string and parsed object
        events[id] = typeof data === "string" ? JSON.parse(data) : data;
      }
    });

    // 3. Process each event for edges
    const allEdges: EdgeResult[] = [];

    for (const eventId of eventIds) {
      const event = events[eventId];
      if (!event) continue;

      // Get all books for this market (index-first)
      const oddsKeys = await getOddsKeysForEventMarket(sportKey, eventId, market);

      if (oddsKeys.length === 0) continue;

      // Fetch all book data
      const oddsDataRaw = await redis.mget<(string | SSEBookSelections | null)[]>(...oddsKeys);

      // Build book → selections map
      const bookSelections: Record<string, SSEBookSelections> = {};
      oddsKeys.forEach((key, i) => {
        const book = normalizeBookId(key.split(":").pop()!);
        const data = oddsDataRaw[i];
        if (data) {
          bookSelections[book] = typeof data === "string" ? JSON.parse(data) : data;
        }
      });

      // Get all unique selection keys
      const allSelectionKeys = new Set<string>();
      Object.values(bookSelections).forEach((selections) => {
        Object.keys(selections).forEach((key) => allSelectionKeys.add(key));
      });

      // Find edges for each selection
      for (const selectionKey of allSelectionKeys) {
        // Skip non-player selections for player props
        if (market.startsWith("player_") && selectionKey.startsWith("game_")) {
          continue;
        }

        // Filter by side if specified
        if (side) {
          const [, selSide] = selectionKey.split("|");
          if (selSide !== side) continue;
        }

        // Gather all book prices for this selection
        const bookPrices: BookPrice[] = [];

        for (const [book, selections] of Object.entries(bookSelections)) {
          const sel = selections[selectionKey];
          if (sel && !sel.locked) {
            bookPrices.push({
              book,
              price: sel.price,
              decimal: sel.price_decimal,
              link: sel.link,
              sgp: sel.sgp,
              selection: sel,
            });
          }
        }

        // Need at least 2 books to compare
        if (bookPrices.length < 2) continue;

        // Sort by best price (highest decimal = best for bettor)
        bookPrices.sort((a, b) => b.decimal - a.decimal);

        const best = bookPrices[0];
        const pinnacle = bookPrices.find((b) => b.book === "pinnacle");
        const circa = bookPrices.find((b) => b.book === "circa");

        // Calculate average
        const avgDecimal =
          bookPrices.reduce((sum, b) => sum + b.decimal, 0) / bookPrices.length;

        // Calculate edges
        const edgeVsPinnacle = pinnacle ? best.decimal - pinnacle.decimal : null;
        const edgeVsPinnaclePct = pinnacle
          ? ((best.decimal / pinnacle.decimal) - 1) * 100
          : null;

        const edgeVsAverage = best.decimal - avgDecimal;
        const edgeVsAveragePct = ((best.decimal / avgDecimal) - 1) * 100;

        // Determine the relevant edge for filtering
        let relevantEdge: number;
        if (compareBook === "average") {
          relevantEdge = edgeVsAverage;
        } else if (compareBook === "circa" && circa) {
          relevantEdge = best.decimal - circa.decimal;
        } else {
          relevantEdge = edgeVsPinnacle ?? edgeVsAverage;
        }

        // Filter by minimum edge
        if (relevantEdge < minEdge) continue;

        // Parse selection key
        const [, selSide, lineStr] = selectionKey.split("|");

        allEdges.push({
          event_id: eventId,
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          is_live: event.is_live,

          player: best.selection.player,
          player_id: best.selection.player_id,
          team: best.selection.team,
          market,
          market_display: getMarketDisplay(market),
          line: parseFloat(lineStr),
          side: selSide as "over" | "under" | "ml" | "spread",

          best_book: best.book,
          best_price: best.price,
          best_decimal: best.decimal,
          best_link: best.link,
          best_sgp: best.sgp,

          pinnacle_price: pinnacle?.price || null,
          pinnacle_decimal: pinnacle?.decimal || null,
          circa_price: circa?.price || null,
          circa_decimal: circa?.decimal || null,
          average_decimal: avgDecimal,

          edge_vs_pinnacle: edgeVsPinnacle,
          edge_vs_pinnacle_pct: edgeVsPinnaclePct,
          edge_vs_average: edgeVsAverage,
          edge_vs_average_pct: edgeVsAveragePct,

          all_books: bookPrices.map((b) => ({
            book: b.book,
            price: b.price,
            decimal: b.decimal,
            link: b.link,
            sgp: b.sgp || null,
            odd_id: b.selection.odd_id || undefined,
          })),
        });
      }
    }

    // Sort by edge (highest first)
    allEdges.sort((a, b) => {
      let aEdge: number;
      let bEdge: number;

      if (compareBook === "average") {
        aEdge = a.edge_vs_average;
        bEdge = b.edge_vs_average;
      } else if (compareBook === "circa") {
        aEdge = a.circa_decimal ? a.best_decimal - a.circa_decimal : a.edge_vs_average;
        bEdge = b.circa_decimal ? b.best_decimal - b.circa_decimal : b.edge_vs_average;
      } else {
        aEdge = a.edge_vs_pinnacle ?? a.edge_vs_average;
        bEdge = b.edge_vs_pinnacle ?? b.edge_vs_average;
      }

      return bEdge - aEdge;
    });

    const response: EdgeFinderResponse = {
      edges: allEdges.slice(0, limit),
      count: Math.min(allEdges.length, limit),
      total_found: allEdges.length,
      market,
      compare_book: compareBook,
      min_edge: minEdge,
    };

    return NextResponse.json(response, {
      headers: {
        // Cache for 10 seconds, stale-while-revalidate for 30
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("[/api/v2/edges] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get active event IDs with fallback
 * 
 * Primary: Use active_events:{sport} SET (fast, O(n))
 * Fallback: Scan events:{sport}:* keys (slower, for when SET isn't populated)
 */
async function getActiveEventIds(sport: string): Promise<string[]> {
  const cached = activeEventsCache.get(sport);
  if (cached && (Date.now() - cached.ts) < ACTIVE_EVENTS_CACHE_TTL) {
    return cached.ids;
  }

  const members = (await redis.smembers(getActiveEventsKey(sport))).map(String).filter(Boolean);
  if (members.length > 8) {
    const unique = [...new Set(members)];
    activeEventsCache.set(sport, { ids: unique, ts: Date.now() });
    return unique;
  }

  const eventKeys = await scanKeys(`events:${sport}:*`);
  const prefix = `events:${sport}:`;
  const scannedIds = eventKeys
    .map((key) => (key.startsWith(prefix) ? key.slice(prefix.length) : ""))
    .filter(Boolean);

  const merged = [...new Set([...members, ...scannedIds])];
  activeEventsCache.set(sport, { ids: merged, ts: Date.now() });
  return merged;
}

async function getOddsKeysForEventMarket(
  sport: string,
  eventId: string,
  market: string
): Promise<string[]> {
  const keys: string[] = [];

  // 1) Preferred path: consumer-maintained event index
  const indexMembers = (await redis.smembers(`odds_idx:${sport}:${eventId}`)).map(String);
  for (const member of indexMembers) {
    const parsed = parseOddsIndexMember(member);
    if (!parsed) continue;
    if (parsed.market !== market) continue;
    for (const candidate of getBookKeyCandidates(parsed.book)) {
      keys.push(`odds:${sport}:${eventId}:${market}:${candidate}`);
    }
  }

  // 2) Deterministic fallback: known-book probes
  for (const book of KNOWN_BOOKS) {
    keys.push(`odds:${sport}:${eventId}:${market}:${book}`);
  }

  const unique = [...new Set(keys)];
  if (unique.length === 0) return [];

  const values = await redis.mget<(string | SSEBookSelections | null)[]>(...unique);
  const existing = unique.filter((_, i) => !!values[i]);
  if (existing.length > 0) return existing;

  // 3) Optional SCAN fallback only when explicitly enabled
  if (ENABLE_ODDS_SCAN_FALLBACK) {
    return scanKeys(`odds:${sport}:${eventId}:${market}:*`);
  }

  return [];
}

/**
 * Scan Redis keys with pattern (safer than KEYS for large datasets)
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  let iterations = 0;
  const seenCursors = new Set<number>();

  do {
    iterations++;
    if (seenCursors.has(cursor)) {
      console.warn(`[v2/edges] Cursor cycle detected for ${pattern}, stopping at ${keys.length} keys`);
      break;
    }
    seenCursors.add(cursor);

    const result: [string, string[]] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT,
    });
    cursor = Number(result[0]);
    keys.push(...result[1]);

    if (iterations >= MAX_SCAN_ITERATIONS) {
      console.warn(`[v2/edges] Hit scan limit for ${pattern}, got ${keys.length} keys`);
      break;
    }
  } while (cursor !== 0);

  return keys;
}
