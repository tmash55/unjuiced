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
  getMarketOddsPattern,
  getMarketDisplay,
} from "@/lib/odds/types";

// Supported sports for this endpoint
const SUPPORTED_SPORTS = new Set(["nba", "nfl", "mlb", "nhl", "ncaab", "ncaaf", "wnba"]);

// Sharp books for comparison (in priority order)
const SHARP_BOOKS = ["pinnacle", "circa"];

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

      // Get all books for this market
      const oddsPattern = getMarketOddsPattern(sportKey, eventId, market);
      const oddsKeys = await scanKeys(oddsPattern);

      if (oddsKeys.length === 0) continue;

      // Fetch all book data
      const oddsDataRaw = await redis.mget<(string | SSEBookSelections | null)[]>(...oddsKeys);

      // Build book → selections map
      const bookSelections: Record<string, SSEBookSelections> = {};
      oddsKeys.forEach((key, i) => {
        const book = key.split(":").pop()!;
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
  // Try the fast SET first
  let eventIds = await redis.smembers(getActiveEventsKey(sport));

  // Fallback: scan event keys if SET is empty
  if (!eventIds || eventIds.length === 0) {
    const eventKeys = await scanKeys(`events:${sport}:*`);
    eventIds = eventKeys.map((key) => key.split(":")[2]);
  }

  return eventIds;
}

/**
 * Scan Redis keys with pattern (safer than KEYS for large datasets)
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = "0";

  do {
    const result: [string, string[]] = await redis.scan(cursor, {
      match: pattern,
      count: 100,
    });
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== "0");

  return keys;
}

