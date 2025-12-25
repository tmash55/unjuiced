export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  getMarketDisplay,
  SSESelection,
  SSEBookSelections,
} from "@/lib/odds/types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const VALID_SPORTS = new Set([
  "nba", "nfl", "nhl", "mlb", "ncaab", "ncaaf", "wnba", "soccer_epl"
]);

// OPTIMIZATION: Higher scan count = fewer round trips
const SCAN_COUNT = 1000;

// OPTIMIZATION: Known sportsbooks to construct exact keys (avoids SCAN)
const KNOWN_BOOKS = [
  "draftkings", "fanduel", "fanduelyourway", "betmgm", "caesars", "pointsbet", "bet365",
  "pinnacle", "circa", "hard-rock", "bally-bet", "betrivers", "unibet",
  "wynnbet", "espnbet", "fanatics", "betparx", "thescore", "prophetx",
  "superbook", "si-sportsbook", "betfred", "tipico", "fliff"
];

// In-memory cache for odds keys (reduces SCAN frequency)
// NOTE: If odds_keys:{sport} set doesn't exist, ingestor needs to populate it
const oddsKeysCache = new Map<string, { keys: string[]; ts: number }>();
const ODDS_KEYS_CACHE_TTL = 30000; // 30 seconds - longer since SCAN fallback is expensive

/**
 * Normalize book IDs to match our canonical sportsbook IDs (from sportsbooks.ts)
 */
function normalizeBookId(id: string): string {
  const lower = id.toLowerCase();
  switch (lower) {
    case "hardrock":
      return "hard-rock";
    case "hardrockindiana":
    case "hardrock-indiana":
      return "hard-rock-indiana";
    case "ballybet":
      return "bally-bet";
    case "sportsinteraction":
      return "sports-interaction";
    // FanDuel YourWay - matches sportsbooks.ts ID
    case "fanduel-yourway":
    case "fanduel_yourway":
      return "fanduelyourway";
    default:
      return lower;
  }
}

/**
 * Normalize market names to match Redis key format
 * Maps frontend-friendly names to actual Redis key market names
 */
function normalizeMarketName(market: string): string {
  const lower = market.toLowerCase();
  
  // Common shorthand → full key mapping
  const marketMap: Record<string, string> = {
    // Game lines
    "spread": "game_spread",
    "point_spread": "game_spread",
    "pointspread": "game_spread",
    "moneyline": "game_moneyline",
    "ml": "game_moneyline",
    "money_line": "game_moneyline",
    "total": "total_points",
    "totals": "total_points",
    "game_total": "total_points",
    "over_under": "total_points",
    "ou": "total_points",
    
    // Half/Quarter shorthands
    "1h_spread": "1st_half_point_spread",
    "1h_total": "1st_half_total_points",
    "1h_ml": "game_1h_moneyline",
    "1q_spread": "1st_quarter_point_spread",
    "1q_total": "1st_quarter_total_points",
    "1q_ml": "game_1q_moneyline",
    
    // Player props shorthands
    "points": "player_points",
    "assists": "player_assists",
    "rebounds": "player_rebounds",
    "threes": "player_threes_made",
    "3pm": "player_threes_made",
    "steals": "player_steals",
    "blocks": "player_blocks",
    "turnovers": "player_turnovers",
    "pra": "player_pra",
    "pts_reb_ast": "player_pra",
    "pr": "player_pr",
    "pts_reb": "player_pr",
    "pa": "player_pa",
    "pts_ast": "player_pa",
    "ra": "player_ra",
    "reb_ast": "player_ra",
    "double_double": "player_double_double",
    "dd": "player_double_double",
    "triple_double": "player_triple_double",
    "td": "player_triple_double",
  };
  
  return marketMap[lower] || lower;
}

/**
 * Normalize side values to "over" or "under" for consistent handling
 * 
 * Side types:
 * - over/under: standard props
 * - yes/no: for yes/no markets (double doubles, anytime scorer, etc.)
 * - spread/ml/moneyline: game lines - treat as single-sided entries
 *   For game lines, we use "over" for positive/favorite sides
 *   and "under" could be the opposite, but often game lines
 *   are displayed as separate rows per team
 */
function normalizeSide(side: string): "over" | "under" | null {
  const lower = side.toLowerCase();
  switch (lower) {
    // Standard over/under
    case "over":
      return "over";
    case "under":
      return "under";
    // Yes/No markets (treated as over/under)
    case "yes":
      return "over";
    case "no":
      return "under";
    // Game lines - each team/selection is its own "side"
    // For spreads: home team at -X and away at +X are displayed separately
    // Treat as "over" since each row represents that specific selection
    case "spread":
    case "ml":
    case "moneyline":
    case "home":
    case "away":
    case "draw":
      return "over"; // Single-sided entries, use "over" slot
    default:
      // Unknown side type - try to handle gracefully
      // If it contains "over" or "yes", treat as over
      if (lower.includes("over") || lower.includes("yes")) return "over";
      if (lower.includes("under") || lower.includes("no")) return "under";
      // Default to "over" for unknown single-sided entries
      return "over";
  }
}

/**
 * OPTIMIZATION: Get odds keys for specific events and market
 * Uses event-scoped scanning: active_events (O(1) SET) + per-event focused scans
 * This avoids maintaining a massive global odds_keys set that's hard to clean up
 */
async function getOddsKeysForEvents(
  sport: string, 
  eventIds: string[], 
  market: string
): Promise<string[]> {
  // Cache key includes events + market for proper invalidation
  const cacheKey = `${sport}:${eventIds.length}:${market}`;
  const cached = oddsKeysCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < ODDS_KEYS_CACHE_TTL) {
    return cached.keys;
  }

  // OPTIMIZED: Scan only for specific market on active events
  // Each scan is focused: odds:{sport}:{eventId}:{market}:*
  // ~10-50 events × 1 market = 10-50 focused scans (much better than global)
  const allKeys: string[] = [];
  
  // Batch scans in parallel (limit concurrency)
  const BATCH_SIZE = 10;
  for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
    const batch = eventIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(eventId => scanKeysOnce(`odds:${sport}:${eventId}:${market}:*`))
    );
    allKeys.push(...batchResults.flat());
  }
  
  oddsKeysCache.set(cacheKey, { keys: allKeys, ts: Date.now() });
  return allKeys;
}

/**
 * Single SCAN call with high count (fallback only)
 */
async function scanKeysOnce(pattern: string): Promise<string[]> {
  const results: string[] = [];
  let cursor = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 20; // Safety limit

  do {
    iterations++;
    const [nextCursor, keys] = await redis.scan(cursor, {
      match: pattern,
      count: SCAN_COUNT,
    });
    cursor = Number(nextCursor);
    results.push(...keys);
    
    if (iterations >= MAX_ITERATIONS) {
      console.warn(`[scanKeysOnce] Hit limit for ${pattern}, got ${results.length} keys`);
      break;
    }
  } while (cursor !== 0);

  return results;
}

/**
 * Get active event IDs for a sport - uses index set (O(1))
 */
async function getActiveEventIds(sport: string): Promise<string[]> {
  const key = `active_events:${sport}`;
  const members = await redis.smembers(key);
  return members.map(String);
}

/**
 * Row format matching the old props API
 */
interface PropsRow {
  sid: string;
  eid: string;
  ent: string;
  player: string | null;
  team: string | null;
  position: string | null;
  mkt: string;
  ln: number;
  ev: {
    dt: string;
    live: boolean;
    home: { id: string; name: string; abbr: string };
    away: { id: string; name: string; abbr: string };
  };
  best?: {
    over?: { bk: string; price: number; limit_max?: number | null };
    under?: { bk: string; price: number; limit_max?: number | null };
  };
  avg?: { over?: number; under?: number };
  books?: Record<string, {
    over?: { price: number; line: number; u: string; m?: string; limit_max?: number | null };
    under?: { price: number; line: number; u: string; m?: string; limit_max?: number | null };
  }>;
  ts?: number;
}

/**
 * Build props rows from new key structure
 */
async function buildPropsRows(
  sport: string,
  marketInput: string,
  scope: "pregame" | "live",
  limit: number
): Promise<{ sids: string[]; rows: PropsRow[]; normalizedMarket: string }> {
  // Normalize market name (e.g., "spread" → "game_spread")
  const market = normalizeMarketName(marketInput);
  
  // 1. Get active events
  const eventIds = await getActiveEventIds(sport);
  if (eventIds.length === 0) {
    return { sids: [], rows: [], normalizedMarket: market };
  }

  // 2. Get event metadata in parallel
  const eventKeys = eventIds.map((id) => `events:${sport}:${id}`);
  const eventsRaw = await redis.mget<(Record<string, unknown> | null)[]>(...eventKeys);

  // Build event map and filter by scope (pregame vs live)
  const now = new Date();
  const eventMap = new Map<string, {
    eventId: string;
    homeTeam: string;
    awayTeam: string;
    homeName: string;
    awayName: string;
    startTime: string;
    isLive: boolean;
  }>();

  eventIds.forEach((id, i) => {
    const event = eventsRaw[i];
    if (!event) return;

    const startTime = (event.commence_time as string) || (event.start_time as string) || "";
    const isLive = event.is_live === true;
    
    // Filter by scope
    if (scope === "pregame") {
      // Only include games that haven't started
      if (startTime) {
        const gameStart = new Date(startTime);
        if (!isNaN(gameStart.getTime()) && gameStart <= now) {
          return; // Skip - game has started
        }
      }
      if (isLive) return;
    } else if (scope === "live") {
      // Only include live games
      if (!isLive) return;
    }

    const homeTeam = (event.home_team as string) || "";
    const awayTeam = (event.away_team as string) || "";
    if (!homeTeam || !awayTeam) return;

    eventMap.set(id, {
      eventId: id,
      homeTeam,
      awayTeam,
      homeName: (event.home_team_name as string) || homeTeam,
      awayName: (event.away_team_name as string) || awayTeam,
      startTime,
      isLive,
    });
  });

  if (eventMap.size === 0) {
    return { sids: [], rows: [], normalizedMarket: market };
  }

  // 3. OPTIMIZATION: Get odds keys scoped to active events + specific market
  // Uses focused per-event scans instead of a massive global odds_keys set
  // Pattern: odds:{sport}:{eventId}:{market}:* for each active event
  const activeEventIdList = Array.from(eventMap.keys());
  const allOddsKeys = await getOddsKeysForEvents(sport, activeEventIdList, market);

  if (allOddsKeys.length === 0) {
    return { sids: [], rows: [], normalizedMarket: market };
  }

  // 4. Fetch all odds data in parallel chunks
  const MGET_CHUNK_SIZE = 500;
  const chunks: string[][] = [];
  for (let i = 0; i < allOddsKeys.length; i += MGET_CHUNK_SIZE) {
    chunks.push(allOddsKeys.slice(i, i + MGET_CHUNK_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map((chunk) => redis.mget<(SSEBookSelections | string | null)[]>(...chunk))
  );
  const allOddsData = chunkResults.flat();

  // Build key -> data map
  const oddsDataMap = new Map<string, SSEBookSelections>();
  allOddsKeys.forEach((key, i) => {
    const data = allOddsData[i];
    if (data) {
      oddsDataMap.set(key, typeof data === "string" ? JSON.parse(data) : data);
    }
  });

  // 5. Aggregate by player/line to build rows
  // Key: "eventId:player:line" -> aggregated data
  const rowMap = new Map<string, {
    eventId: string;
    player: string;
    playerId: string;
    team: string | null;
    position: string | null;
    line: number;
    books: Map<string, {
      over?: SSESelection;
      under?: SSESelection;
    }>;
  }>();

  // THREE-PASS APPROACH:
  // Pass 1: Find main lines (main=true) for each player per book
  // Pass 1.5: Determine canonical main line per player (FanDuel > DraftKings > any book with main=true)
  // Pass 2: Build rows using canonical main lines for all books
  
  // Structure to track main lines: eventId:player:book -> line number
  const mainLinesByPlayerBook = new Map<string, number>();
  // Canonical main line per player: eventId:player -> { line, source }
  const canonicalMainLine = new Map<string, { line: number; priority: number }>();
  
  // Priority order for determining canonical main line (lower = higher priority)
  const BOOK_PRIORITY: Record<string, number> = {
    "fanduel": 1,
    "draftkings": 2,
    "betmgm": 3,
    "caesars": 4,
    "pinnacle": 5,
  };
  const DEFAULT_PRIORITY = 99;
  
  // PASS 1: Collect all main=true selections and their lines
  for (const [key, selections] of oddsDataMap) {
    const parts = key.split(":");
    const eventId = parts[2];
    const book = normalizeBookId(parts[4]);

    if (!eventMap.has(eventId)) continue;

    for (const [selKey, sel] of Object.entries(selections)) {
      if (sel.main !== true) continue;
      
      const [playerRaw, , lineStr] = selKey.split("|");
      if (!playerRaw || !lineStr) continue;

      const line = parseFloat(lineStr);
      if (isNaN(line)) continue;

      // Track the main line for this player+book
      const playerBookKey = `${eventId}:${playerRaw}:${book}`;
      mainLinesByPlayerBook.set(playerBookKey, line);
      
      // Update canonical main line if this book has higher priority
      const playerKey = `${eventId}:${playerRaw}`;
      const bookPriority = BOOK_PRIORITY[book] || DEFAULT_PRIORITY;
      const existing = canonicalMainLine.get(playerKey);
      
      if (!existing || bookPriority < existing.priority) {
        canonicalMainLine.set(playerKey, { line, priority: bookPriority });
      }
    }
  }
  
  // PASS 2: Build rows using main lines OR canonical main line for books without main=true
  for (const [key, selections] of oddsDataMap) {
    const parts = key.split(":");
    const eventId = parts[2];
    const book = normalizeBookId(parts[4]);

    if (!eventMap.has(eventId)) continue;

    for (const [selKey, sel] of Object.entries(selections)) {
      const [playerRaw, side, lineStr] = selKey.split("|");
      if (!playerRaw || !side || !lineStr) continue;

      const line = parseFloat(lineStr);
      if (isNaN(line)) continue;

      const playerBookKey = `${eventId}:${playerRaw}:${book}`;
      const playerKey = `${eventId}:${playerRaw}`;
      
      // Check if this book has its own main line
      const bookMainLine = mainLinesByPlayerBook.get(playerBookKey);
      // Get canonical main line (from FanDuel/DraftKings/etc)
      const canonical = canonicalMainLine.get(playerKey);
      
      // Determine which line to use:
      // 1. If this book has main=true for any line, use that
      // 2. Otherwise, fall back to canonical main line from priority books
      const targetLine = bookMainLine ?? canonical?.line;
      
      // Only include if line matches the target (main or canonical)
      if (targetLine === undefined || line !== targetLine) continue;

      // Use player name from selection data
      const player = sel.player || playerRaw;
      const rowKey = `${eventId}:${playerRaw}`;

      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, {
          eventId,
          player,
          playerId: sel.player_id || "",
          team: sel.team || null,
          position: sel.position || null,
          line,
          books: new Map(),
        });
      }

      const row = rowMap.get(rowKey)!;
      if (!row.books.has(book)) {
        row.books.set(book, {});
      }

      const bookData = row.books.get(book)!;
      
      // Handle different side types
      const normalizedSide = normalizeSide(side);
      if (normalizedSide === "over") {
        bookData.over = sel;
        if (!row.line || row.line === 0) row.line = line;
      } else if (normalizedSide === "under") {
        bookData.under = sel;
        if (!row.line || row.line === 0) row.line = line;
      }
    }
  }

  // 6. Build PropsRow format
  const rows: PropsRow[] = [];
  const sids: string[] = [];

  for (const [rowKey, data] of rowMap) {
    const event = eventMap.get(data.eventId);
    if (!event) continue;

    // Build books object
    const books: PropsRow["books"] = {};
    let bestOver: { bk: string; price: number; limit_max?: number | null } | undefined;
    let bestUnder: { bk: string; price: number; limit_max?: number | null } | undefined;
    let sumOverProb = 0;
    let countOver = 0;
    let sumUnderProb = 0;
    let countUnder = 0;

    for (const [bookId, bookData] of data.books) {
      const bookEntry: NonNullable<PropsRow["books"]>[string] = {};

      if (bookData.over) {
        const price = parseInt(bookData.over.price.replace("+", ""), 10);
        const limitMax = bookData.over.limits?.max || null;
        bookEntry.over = {
          price,
          line: bookData.over.line,
          u: bookData.over.link || "",
          limit_max: limitMax,
        };

        // Track best over (include limits for best book)
        if (!bestOver || price > parseInt(bestOver.price.toString(), 10)) {
          bestOver = { bk: bookId, price, limit_max: limitMax };
        }

        // Sum for average (convert to probability)
        const decimal = bookData.over.price_decimal;
        if (decimal > 0) {
          sumOverProb += 1 / decimal;
          countOver++;
        }
      }

      if (bookData.under) {
        const price = parseInt(bookData.under.price.replace("+", ""), 10);
        const limitMax = bookData.under.limits?.max || null;
        bookEntry.under = {
          price,
          line: bookData.under.line,
          u: bookData.under.link || "",
          limit_max: limitMax,
        };

        // Track best under (include limits for best book)
        if (!bestUnder || price > parseInt(bestUnder.price.toString(), 10)) {
          bestUnder = { bk: bookId, price, limit_max: limitMax };
        }

        // Sum for average
        const decimal = bookData.under.price_decimal;
        if (decimal > 0) {
          sumUnderProb += 1 / decimal;
          countUnder++;
        }
      }

      if (bookEntry.over || bookEntry.under) {
        books[bookId] = bookEntry;
      }
    }

    // Skip rows with no books
    if (Object.keys(books).length === 0) continue;

    // Calculate average odds
    const avgOver = countOver > 0
      ? probToAmerican(sumOverProb / countOver)
      : undefined;
    const avgUnder = countUnder > 0
      ? probToAmerican(sumUnderProb / countUnder)
      : undefined;

    // Generate SID
    const sid = `${sport}:${data.eventId}:${market}:${data.playerId || data.player}:${data.line}`;

    sids.push(sid);
    rows.push({
      sid,
      eid: data.eventId,
      ent: data.playerId ? `pid:${data.playerId}` : `pid:${data.player}`,
      player: data.player,
      team: data.team,
      position: data.position,
      mkt: market,
      ln: data.line,
      ev: {
        dt: event.startTime,
        live: event.isLive,
        home: { id: "", name: event.homeName, abbr: event.homeTeam },
        away: { id: "", name: event.awayName, abbr: event.awayTeam },
      },
      best: {
        over: bestOver,
        under: bestUnder,
      },
      avg: {
        over: avgOver,
        under: avgUnder,
      },
      books,
      ts: Date.now(),
    });
  }

  // 7. Sort by best edge (best over price) and limit
  rows.sort((a, b) => {
    const aPrice = a.best?.over?.price ?? -Infinity;
    const bPrice = b.best?.over?.price ?? -Infinity;
    return bPrice - aPrice; // Higher price first
  });

  const limitedRows = rows.slice(0, limit);
  const limitedSids = sids.slice(0, limit);

  return { sids: limitedSids, rows: limitedRows, normalizedMarket: market };
}

/**
 * Convert probability to American odds
 */
function probToAmerican(prob: number): number {
  if (prob >= 0.5) {
    return Math.round(-(prob / (1 - prob)) * 100);
  } else {
    return Math.round(((1 - prob) / prob) * 100);
  }
}

function parseIntSafe(v: string | null, def: number): number {
  const n = Number(v ?? "");
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const sport = (sp.get("sport") || "").trim().toLowerCase();
    const market = (sp.get("market") || "").trim();
    const scope = (sp.get("scope") || "pregame").toLowerCase() as "pregame" | "live";
    const limit = Math.max(1, Math.min(500, parseIntSafe(sp.get("limit"), 200)));

    // Validate sport
    if (!sport || !VALID_SPORTS.has(sport)) {
      return NextResponse.json(
        { error: "invalid_sport", valid: Array.from(VALID_SPORTS) },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!market) {
      return NextResponse.json(
        { error: "market_required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const startTime = performance.now();

    // Build rows from new key structure (market gets normalized inside)
    const { sids, rows, normalizedMarket } = await buildPropsRows(sport, market, scope, limit);

    const duration = performance.now() - startTime;

    if (process.env.NODE_ENV === "development") {
      const marketNote = market !== normalizedMarket ? ` (normalized: ${normalizedMarket})` : '';
      console.log(`[v2/props/table] ${sport} ${market}${marketNote} (${scope}): ${rows.length} rows in ${duration.toFixed(0)}ms`);
    }

    return NextResponse.json(
      { 
        sids, 
        rows, 
        nextCursor: rows.length >= limit ? String(limit) : null,
        meta: {
          sport,
          market: normalizedMarket, // Use normalized market in response
          market_input: market, // Original input for debugging
          market_display: getMarketDisplay(normalizedMarket),
          scope,
          count: rows.length,
          duration_ms: Math.round(duration),
        }
      },
      {
        headers: {
          "Cache-Control": scope === "live" ? "no-store" : "public, max-age=30, s-maxage=30",
        },
      }
    );
  } catch (error: any) {
    console.error("[v2/props/table] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

