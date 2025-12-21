/**
 * Odds API v2 - SSE-Powered
 * 
 * Returns all sportsbook odds for a specific event and market.
 * 
 * GET /api/v2/odds/nba/{eventId}/player_points
 */

import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  SSEEvent,
  SSEBookSelections,
  SSESelection,
  getEventKey,
  getMarketOddsPattern,
  getMarketDisplay,
  normalizePlayerName,
} from "@/lib/odds/types";

// Supported sports
const SUPPORTED_SPORTS = new Set(["nba", "nfl", "mlb", "nhl", "ncaab", "ncaaf", "wnba"]);

interface PlayerOdds {
  player: string;
  player_id: string;
  team: string;
  position: string;
  line: number;
  over: {
    best_book: string;
    best_price: string;
    best_decimal: number;
    best_link: string;
    sgp: string | null;
    all_books: Array<{
      book: string;
      price: string;
      decimal: number;
      link: string;
    }>;
  } | null;
  under: {
    best_book: string;
    best_price: string;
    best_decimal: number;
    best_link: string;
    sgp: string | null;
    all_books: Array<{
      book: string;
      price: string;
      decimal: number;
      link: string;
    }>;
  } | null;
}

interface OddsResponse {
  event: SSEEvent | null;
  market: string;
  market_display: string;
  players: PlayerOdds[];
  books: string[];
  count: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sport: string; eventId: string; market: string }> }
) {
  try {
    const { sport, eventId, market } = await params;
    
    // Validate sport
    if (!SUPPORTED_SPORTS.has(sport.toLowerCase())) {
      return NextResponse.json(
        { error: "Unsupported sport", supported: Array.from(SUPPORTED_SPORTS) },
        { status: 400 }
      );
    }

    const sportKey = sport.toLowerCase();
    const url = new URL(request.url);

    // Optional filters
    const playerFilter = url.searchParams.get("player"); // Filter by player name
    const lineFilter = url.searchParams.get("line"); // Filter by specific line

    // 1. Get event metadata
    const eventKey = getEventKey(sportKey, eventId);
    const eventDataRaw = await redis.get<string | SSEEvent | null>(eventKey);
    const event: SSEEvent | null = eventDataRaw
      ? typeof eventDataRaw === "string"
        ? JSON.parse(eventDataRaw)
        : eventDataRaw
      : null;

    // 2. Get all books for this market
    const oddsPattern = getMarketOddsPattern(sportKey, eventId, market);
    const oddsKeys = await scanKeys(oddsPattern);

    if (oddsKeys.length === 0) {
      return NextResponse.json({
        event,
        market,
        market_display: getMarketDisplay(market),
        players: [],
        books: [],
        count: 0,
      } as OddsResponse);
    }

    // 3. Fetch all book data
    const oddsDataRaw = await redis.mget<(string | SSEBookSelections | null)[]>(...oddsKeys);

    // Build book → selections map
    const bookSelections: Record<string, SSEBookSelections> = {};
    const allBooks: string[] = [];
    
    oddsKeys.forEach((key, i) => {
      const book = key.split(":").pop()!;
      const data = oddsDataRaw[i];
      if (data) {
        bookSelections[book] = typeof data === "string" ? JSON.parse(data) : data;
        allBooks.push(book);
      }
    });

    // 4. Aggregate by player/line
    const playerLineMap = new Map<string, {
      player: string;
      player_id: string;
      team: string;
      position: string;
      line: number;
      over: Array<{ book: string; selection: SSESelection }>;
      under: Array<{ book: string; selection: SSESelection }>;
    }>();

    for (const [book, selections] of Object.entries(bookSelections)) {
      for (const [selectionKey, sel] of Object.entries(selections) as [string, SSESelection][]) {
        // Skip game-level selections for player props
        if (market.startsWith("player_") && selectionKey.startsWith("game_")) {
          continue;
        }

        // Apply player filter
        if (playerFilter) {
          const normalizedFilter = normalizePlayerName(playerFilter);
          const normalizedPlayer = normalizePlayerName(sel.player);
          if (!normalizedPlayer.includes(normalizedFilter)) continue;
        }

        // Apply line filter
        if (lineFilter && sel.line !== parseFloat(lineFilter)) {
          continue;
        }

        // Skip locked selections
        if (sel.locked) continue;

        // Create player/line key (only for main lines)
        const playerLineKey = `${normalizePlayerName(sel.player)}|${sel.line}`;

        if (!playerLineMap.has(playerLineKey)) {
          playerLineMap.set(playerLineKey, {
            player: sel.player,
            player_id: sel.player_id,
            team: sel.team,
            position: sel.position,
            line: sel.line,
            over: [],
            under: [],
          });
        }

        const playerData = playerLineMap.get(playerLineKey)!;
        if (sel.side === "over") {
          playerData.over.push({ book, selection: sel });
        } else if (sel.side === "under") {
          playerData.under.push({ book, selection: sel });
        }
      }
    }

    // 5. Build response with best odds
    const players: PlayerOdds[] = [];

    for (const [, data] of playerLineMap) {
      // Sort by best price
      data.over.sort((a, b) => b.selection.price_decimal - a.selection.price_decimal);
      data.under.sort((a, b) => b.selection.price_decimal - a.selection.price_decimal);

      const bestOver = data.over[0];
      const bestUnder = data.under[0];

      players.push({
        player: data.player,
        player_id: data.player_id,
        team: data.team,
        position: data.position,
        line: data.line,
        over: bestOver
          ? {
              best_book: bestOver.book,
              best_price: bestOver.selection.price,
              best_decimal: bestOver.selection.price_decimal,
              best_link: bestOver.selection.link,
              sgp: bestOver.selection.sgp,
              all_books: data.over.map((o) => ({
                book: o.book,
                price: o.selection.price,
                decimal: o.selection.price_decimal,
                link: o.selection.link,
              })),
            }
          : null,
        under: bestUnder
          ? {
              best_book: bestUnder.book,
              best_price: bestUnder.selection.price,
              best_decimal: bestUnder.selection.price_decimal,
              best_link: bestUnder.selection.link,
              sgp: bestUnder.selection.sgp,
              all_books: data.under.map((u) => ({
                book: u.book,
                price: u.selection.price,
                decimal: u.selection.price_decimal,
                link: u.selection.link,
              })),
            }
          : null,
      });
    }

    // Sort by player name
    players.sort((a, b) => a.player.localeCompare(b.player));

    const response: OddsResponse = {
      event,
      market,
      market_display: getMarketDisplay(market),
      players,
      books: allBooks.sort(),
      count: players.length,
    };

    return NextResponse.json(response, {
      headers: {
        // Cache for 5 seconds (odds change frequently)
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
      },
    });
  } catch (error) {
    console.error("[/api/v2/odds] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Scan Redis keys with pattern (safer than KEYS for large datasets)
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | number = "0";

  do {
    const result = await redis.scan(cursor, {
      match: pattern,
      count: 100,
    });
    cursor = result[0];
    keys.push(...result[1]);
  } while (cursor !== "0" && cursor !== 0);

  return keys;
}

