import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import { z } from "zod";

/**
 * Hit Rate Matrix API
 * 
 * Returns hit rates across fixed point thresholds (5, 10, 15, 20, 25, 30, 35, 40, 45, 50)
 * for all players on a given date. Includes DvP rank, primary line, and odds at each threshold.
 * 
 * Uses the same RPC function as hit-rates v2 API for consistency:
 * - get_nba_hit_rate_profiles_fast_v3: Denormalized profiles with sel_key, dvp_rank, etc.
 * - Redis linesidx/booksidx/odds: Live odds at each threshold
 */

// =============================================================================
// TYPES
// =============================================================================

interface RedisOddEntry {
  player_id: string;
  player?: string;
  side: "over" | "under";
  line: number;
  price: string | number;
  link?: string;
  mobile_link?: string;
}

type RedisOddsBlob = Record<string, RedisOddEntry>;

interface ThresholdData {
  line: number;
  actualLine: number | null; // The actual sportsbook line used (may differ from threshold)
  hitRate: number | null;    // Keep for context
  hits: number;
  games: number;
  // Odds data
  bestOdds: number | null;       // American odds (display)
  bestDecimal: number | null;    // Decimal odds (calculation)
  bestBook: string | null;
  oddsLink: string | null;
  // Edge calculation (odds-based: best vs market average)
  avgDecimal: number | null;     // Average across all books
  edgePct: number | null;        // ((best/avg) - 1) * 100
  bookCount: number;             // Number of books with odds
  isBestCell: boolean;           // True if this is the best edge cell in the row
}

interface HitRateMatrixRow {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  position: string;
  eventId: string;
  gameId: number | null;  // Numeric game ID for matching with useNbaGames
  selKey: string;
  gameDate: string;
  opponentAbbr: string;
  homeAway: string;
  dvpRank: number | null;
  dvpQuality: "favorable" | "neutral" | "unfavorable" | null;
  primaryLine: number | null;
  thresholds: ThresholdData[];
  primaryColor: string | null;
  secondaryColor: string | null;
}

interface HitRateMatrixResponse {
  rows: HitRateMatrixRow[];
  market: string;
  timeWindow: string;
  thresholdLines: number[];
  count: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Market-specific thresholds - different stats need different increments
const MARKET_THRESHOLDS: Record<string, number[]> = {
  // Points: 5-50 by 5s (high volume stat)
  player_points: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
  
  // Rebounds: 2-16 by 2s (medium volume stat)
  player_rebounds: [2, 4, 6, 8, 10, 12, 14, 16],
  
  // Assists: 2-14 by 2s (medium volume stat)
  player_assists: [2, 4, 6, 8, 10, 12, 14],
  
  // 3PM: 1-8 by 1s (low volume stat)
  player_threes_made: [1, 2, 3, 4, 5, 6, 7, 8],
  
  // Blocks: 1-6 by 1s (very low volume stat)
  player_blocks: [1, 2, 3, 4, 5, 6],
  
  // Steals: 1-6 by 1s (very low volume stat)
  player_steals: [1, 2, 3, 4, 5, 6],
  
  // Turnovers: 1-7 by 1s (low volume stat)
  player_turnovers: [1, 2, 3, 4, 5, 6, 7],
  
  // PRA (Points + Rebounds + Assists): 10-60 by 5s (combined high volume)
  player_points_rebounds_assists: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
  
  // P+R: 5-45 by 5s
  player_points_rebounds: [5, 10, 15, 20, 25, 30, 35, 40, 45],
  
  // P+A: 5-45 by 5s
  player_points_assists: [5, 10, 15, 20, 25, 30, 35, 40, 45],
  
  // R+A: 3-21 by 3s
  player_rebounds_assists: [3, 6, 9, 12, 15, 18, 21],
  
  // Blocks + Steals: 1-8 by 1s
  player_blocks_steals: [1, 2, 3, 4, 5, 6, 7, 8],
};

// Fallback thresholds
const DEFAULT_THRESHOLDS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

function getThresholdsForMarket(market: string): number[] {
  return MARKET_THRESHOLDS[market] || DEFAULT_THRESHOLDS;
}

// Market to stat column mapping
const MARKET_TO_STAT: Record<string, string> = {
  player_points: "pts",
  player_rebounds: "reb",
  player_assists: "ast",
  player_threes_made: "fg3m",
  player_blocks: "blk",
  player_steals: "stl",
  player_turnovers: "tov",
  player_points_rebounds_assists: "pra",
  player_points_rebounds: "pr",
  player_points_assists: "pa",
  player_rebounds_assists: "ra",
  player_blocks_steals: "bs",
};

// =============================================================================
// VALIDATION
// =============================================================================

const RequestSchema = z.object({
  market: z.string().optional().default("player_points"),
  gameDate: z.string().optional(),
  timeWindow: z.enum(["last_5", "last_10", "last_20", "season"]).optional().default("last_10"),
  positions: z.array(z.string()).optional(),
  minGames: z.number().optional().default(5),
});

// =============================================================================
// HELPERS
// =============================================================================

function getETDate(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parsePrice(val: string | number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return val;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Convert American odds to decimal odds
 * +150 → 2.50 (win $150 on $100 bet = $250 total return)
 * -150 → 1.67 (win $67 on $100 bet = $167 total return)
 */
function americanToDecimal(american: number): number {
  if (american > 0) {
    return (american / 100) + 1;
  } else {
    return (100 / Math.abs(american)) + 1;
  }
}

/**
 * Get stat value from game log based on market
 */
function getStatFromLog(log: any, market: string): number | null {
  // First, check if market_stat exists (pre-calculated value)
  if (log.market_stat !== undefined && log.market_stat !== null) {
    return log.market_stat;
  }
  
  // For combo markets, calculate from components
  if (market === "player_points_rebounds_assists") {
    if (log.pts !== undefined || log.reb !== undefined || log.ast !== undefined) {
      return (log.pts ?? 0) + (log.reb ?? 0) + (log.ast ?? 0);
    }
  } else if (market === "player_points_rebounds") {
    if (log.pts !== undefined || log.reb !== undefined) {
      return (log.pts ?? 0) + (log.reb ?? 0);
    }
  } else if (market === "player_points_assists") {
    if (log.pts !== undefined || log.ast !== undefined) {
      return (log.pts ?? 0) + (log.ast ?? 0);
    }
  } else if (market === "player_rebounds_assists") {
    if (log.reb !== undefined || log.ast !== undefined) {
      return (log.reb ?? 0) + (log.ast ?? 0);
    }
  } else if (market === "player_blocks_steals") {
    if (log.blk !== undefined || log.stl !== undefined) {
      return (log.blk ?? 0) + (log.stl ?? 0);
    }
  }
  
  // For single-stat markets
  const statColumn = MARKET_TO_STAT[market];
  return log[statColumn] ?? null;
}

/**
 * Calculate hit rate for a given stat value array at a threshold
 */
function calculateHitRateForThreshold(
  stats: number[],
  threshold: number
): { hitRate: number | null; hits: number; games: number } {
  if (stats.length === 0) return { hitRate: null, hits: 0, games: 0 };
  const hits = stats.filter(v => v > threshold).length;
  return {
    hitRate: Math.round((hits / stats.length) * 100),
    hits,
    games: stats.length,
  };
}

/**
 * Determine matchup quality from DvP rank
 */
function getDvpQuality(dvpRank: number | null): "favorable" | "neutral" | "unfavorable" | null {
  if (dvpRank === null) return null;
  if (dvpRank <= 10) return "unfavorable"; // Tough defense (ranks 1-10)
  if (dvpRank >= 21) return "favorable";   // Weak defense (ranks 21-30)
  return "neutral";
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { market, gameDate, timeWindow, positions, minGames } = parsed.data;
    const targetDate = gameDate || getETDate();

    const supabase = await createServerSupabaseClient();

    // Step 1: Use RPC to get profiles with denormalized data (sel_key, dvp_rank, player info)
    // Note: RPC doesn't include game_logs for performance, we'll fetch those separately
    const { data: profiles, error: profilesError } = await supabase.rpc("get_nba_hit_rate_profiles_fast_v3", {
      p_dates: [targetDate],
      p_market: market,
      p_has_odds: false, // We want all profiles, not just those with odds
      p_limit: 500,
      p_offset: 0,
    });

    if (profilesError) {
      console.error("[hit-rate-matrix] RPC error:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch profiles", details: profilesError.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.log(`[hit-rate-matrix] RPC returned ${profiles?.length || 0} profiles for ${targetDate}/${market}`);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        rows: [],
        market,
        timeWindow,
        thresholdLines: getThresholdsForMarket(market),
        count: 0,
      }, {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }

    // Step 2: Fetch game_logs for all players in this market
    // We need game_logs to calculate hit rates at arbitrary thresholds
    const playerIds = [...new Set(profiles.map((p: any) => p.player_id))];
    
    const { data: gameLogsData, error: gameLogsError } = await supabase
      .from("nba_hit_rate_profiles")
      .select("player_id, game_logs")
      .eq("market", market)
      .eq("game_date", targetDate)
      .in("player_id", playerIds);

    if (gameLogsError) {
      console.error("[hit-rate-matrix] Game logs error:", gameLogsError);
    }

    // Build a map of player_id -> game_logs
    const gameLogsMap = new Map<number, any[]>();
    for (const row of gameLogsData || []) {
      if (row.game_logs && Array.isArray(row.game_logs)) {
        gameLogsMap.set(row.player_id, row.game_logs);
      }
    }

    console.log(`[hit-rate-matrix] Fetched game_logs for ${gameLogsMap.size} players`);

    // Determine window size for game logs
    let windowSize: number;
    switch (timeWindow) {
      case "last_5": windowSize = 5; break;
      case "last_10": windowSize = 10; break;
      case "last_20": windowSize = 20; break;
      case "season": windowSize = 100; break;
      default: windowSize = 10;
    }

    // Process profiles and build matrix rows
    const rows: HitRateMatrixRow[] = [];
    
    // Collect all event/market/player combinations for batch odds fetching
    const oddsLookups: Array<{
      eventId: string;
      market: string;
      playerUuid: string;
      profile: any;
      gameLogs: any[];
    }> = [];

    for (const profile of profiles) {
      // Get game_logs from the separate fetch
      const gameLogs = gameLogsMap.get(profile.player_id) || [];
      if (gameLogs.length < minGames) continue;

      // Apply position filter if provided
      // RPC returns denormalized position fields
      const position = profile.player_depth_chart_pos || profile.player_position;
      
      if (positions && positions.length > 0) {
        if (!position || !positions.includes(position)) continue;
      }

      // Extract player UUID from sel_key if needed
      const selKey = profile.sel_key;
      if (!selKey || !profile.event_id) continue;
      
      const playerUuid = selKey.includes(':') ? selKey.split(':')[0] : selKey;

      oddsLookups.push({
        eventId: profile.event_id,
        market,
        playerUuid,
        profile,
        gameLogs,
      });
    }
    
    console.log(`[hit-rate-matrix] ${oddsLookups.length} players passed filters`);

    // Get the thresholds for this market
    const thresholdsForMarket = getThresholdsForMarket(market);

    // Batch fetch available lines from Redis for all players
    const linesPromises = oddsLookups.map(async (lookup) => {
      const linesKey = `linesidx:nba:${lookup.eventId}:${lookup.market}:${lookup.playerUuid}`;
      const linesRaw = await redis.zrange(linesKey, 0, -1);
      return {
        ...lookup,
        availableLines: linesRaw?.map(l => parseFloat(String(l))).filter(l => !isNaN(l)) || [],
      };
    });

    const linesResults = await Promise.all(linesPromises);

    // Log sample of available lines for debugging
    if (linesResults.length > 0) {
      const sample = linesResults[0];
      console.log(`[hit-rate-matrix] Sample player ${sample.playerUuid} available lines:`, sample.availableLines.slice(0, 10));
      console.log(`[hit-rate-matrix] Thresholds for ${market}:`, thresholdsForMarket);
    }

    // Helper: Find the closest available line to a threshold (prefer line >= threshold for "over" bets)
    function findClosestLine(availableLines: number[], threshold: number): number | null {
      if (availableLines.length === 0) return null;
      
      // First try to find an exact match
      if (availableLines.includes(threshold)) return threshold;
      
      // Find lines close to threshold (within 1 point), preferring line >= threshold - 0.5
      // For "over X+" we want a line around X (e.g., for "5+" threshold, line 4.5 or 5.5 works)
      const candidates = availableLines.filter(l => Math.abs(l - threshold) <= 1);
      if (candidates.length === 0) return null;
      
      // Prefer the line closest to threshold
      candidates.sort((a, b) => Math.abs(a - threshold) - Math.abs(b - threshold));
      return candidates[0];
    }

    // Collect all unique books we need to query for odds
    const allBooks = new Set<string>();
    const playerLineBooks = new Map<string, string[]>(); // "eventId:playerUuid:line" -> books[]
    const thresholdToLineMap = new Map<string, number>(); // "eventId:playerUuid:threshold" -> actual line

    // For each player, map thresholds to closest available lines and fetch books
    const booksPromises: Promise<{ key: string; actualLine: number; books: string[] }>[] = [];
    
    for (const result of linesResults) {
      for (const threshold of thresholdsForMarket) {
        const closestLine = findClosestLine(result.availableLines, threshold);
        if (closestLine !== null) {
          const booksKey = `booksidx:nba:${result.eventId}:${result.market}:${result.playerUuid}:${closestLine}`;
          const lookupKey = `${result.eventId}:${result.playerUuid}:${threshold}`;
          
          // Store the mapping from threshold to actual line
          thresholdToLineMap.set(lookupKey, closestLine);
          
          booksPromises.push(
            redis.smembers(booksKey).then(books => ({
              key: lookupKey,
              actualLine: closestLine,
              books: books || [],
            }))
          );
        }
      }
    }

    const booksResults = await Promise.all(booksPromises);
    
    for (const { key, books } of booksResults) {
      playerLineBooks.set(key, books);
      for (const book of books) {
        allBooks.add(book);
      }
    }

    // Fetch odds blobs for all relevant books
    const uniqueEventMarkets = new Set<string>();
    for (const result of linesResults) {
      uniqueEventMarkets.add(`${result.eventId}:${result.market}`);
    }

    const oddsMap = new Map<string, RedisOddsBlob>();
    
    const oddsPromises = Array.from(uniqueEventMarkets).flatMap(em => {
      const [eventId, mkt] = em.split(':');
      return Array.from(allBooks).map(async (book) => {
        const oddsKey = `odds:nba:${eventId}:${mkt}:${book}`;
        const oddsBlob = await redis.get<RedisOddsBlob>(oddsKey);
        return { key: `${eventId}:${mkt}:${book}`, oddsBlob };
      });
    });

    const oddsResultsRaw = await Promise.all(oddsPromises);
    
    for (const { key, oddsBlob } of oddsResultsRaw) {
      if (oddsBlob && typeof oddsBlob === 'object') {
        oddsMap.set(key, oddsBlob);
      }
    }
    
    console.log(`[hit-rate-matrix] Found ${allBooks.size} unique books, ${oddsMap.size} odds blobs, ${thresholdToLineMap.size} line mappings`);

    // Now build the matrix rows with calculated hit rates and odds
    for (const result of linesResults) {
      const profile = result.profile;
      const gameLogs = result.gameLogs || [];
      
      // Get stats for the time window
      const stats: number[] = [];
      for (let i = 0; i < Math.min(windowSize, gameLogs.length); i++) {
        const stat = getStatFromLog(gameLogs[i], market);
        if (stat !== null) {
          stats.push(stat);
        }
      }

      if (stats.length < minGames) continue;

      // RPC returns denormalized fields directly
      const position = profile.player_depth_chart_pos || profile.player_position;

      // Calculate hit rates at each threshold
      const thresholds: ThresholdData[] = [];
      
      for (const threshold of thresholdsForMarket) {
        const { hitRate, hits, games } = calculateHitRateForThreshold(stats, threshold);
        
        const lookupKey = `${result.eventId}:${result.playerUuid}:${threshold}`;
        const booksForLine = playerLineBooks.get(lookupKey) || [];
        const actualLine = thresholdToLineMap.get(lookupKey); // Get the actual sportsbook line
        
        // Collect ALL book prices for this threshold (for edge calculation)
        // Exclude prediction markets and books with extreme outlier odds
        const EXCLUDED_BOOKS_FOR_EDGE = new Set([
          'polymarket',
          'kalshi',
          'predictit',
        ]);
        const MAX_ODDS_MAGNITUDE = 5000; // Exclude odds like -9900 or +9900
        
        const bookPrices: { book: string; american: number; decimal: number; link: string | null }[] = [];
        
        for (const book of booksForLine) {
          // Skip excluded books (prediction markets)
          if (EXCLUDED_BOOKS_FOR_EDGE.has(book.toLowerCase())) continue;
          
          const oddsBlob = oddsMap.get(`${result.eventId}:${market}:${book}`);
          if (!oddsBlob) continue;
          
          // Find the over odds for this player and actual line
          for (const [, entry] of Object.entries(oddsBlob)) {
            if (!entry || typeof entry !== 'object' || !entry.player_id) continue;
            
            // Match player and actual line (the sportsbook's line, not our threshold)
            if (entry.player_id === result.playerUuid && entry.line === actualLine && entry.side === 'over') {
              const price = parsePrice(entry.price);
              if (price !== null) {
                // Skip extreme outlier odds (e.g., -9900, +9900)
                if (Math.abs(price) > MAX_ODDS_MAGNITUDE) continue;
                
                bookPrices.push({
                  book,
                  american: price,
                  decimal: americanToDecimal(price),
                  link: entry.link || entry.mobile_link || null,
                });
              }
            }
          }
        }

        // Calculate edge (best price vs market average)
        let bestOdds: number | null = null;
        let bestDecimal: number | null = null;
        let bestBook: string | null = null;
        let oddsLink: string | null = null;
        let avgDecimal: number | null = null;
        let edgePct: number | null = null;
        const bookCount = bookPrices.length;

        if (bookPrices.length >= 1) {
          // Sort by best price (highest decimal = best for bettor)
          bookPrices.sort((a, b) => b.decimal - a.decimal);
          const best = bookPrices[0];
          
          bestOdds = best.american;
          bestDecimal = best.decimal;
          bestBook = best.book;
          oddsLink = best.link;
          
          if (bookPrices.length >= 2) {
            // Calculate average across all books
            avgDecimal = bookPrices.reduce((sum, b) => sum + b.decimal, 0) / bookPrices.length;
            // Edge = ((best / avg) - 1) * 100
            edgePct = Math.round(((bestDecimal / avgDecimal) - 1) * 1000) / 10;
          }
        }

        thresholds.push({
          line: threshold,
          actualLine: actualLine ?? null,
          hitRate,
          hits,
          games,
          bestOdds,
          bestDecimal,
          bestBook,
          oddsLink,
          avgDecimal,
          edgePct,
          bookCount,
          isBestCell: false, // Will be set below
        });
      }

      // Find and mark the best cell (highest positive edge) for this row
      let bestCellIndex = -1;
      let bestEdge = 0;
      for (let i = 0; i < thresholds.length; i++) {
        const t = thresholds[i];
        if (t.edgePct !== null && t.edgePct > bestEdge) {
          bestEdge = t.edgePct;
          bestCellIndex = i;
        }
      }
      // Only mark if we found a positive edge
      if (bestCellIndex >= 0 && bestEdge > 0) {
        thresholds[bestCellIndex].isBestCell = true;
      }

      // RPC returns denormalized dvp_rank
      const dvpRank = profile.dvp_rank ?? null;
      const dvpQuality = getDvpQuality(dvpRank);

      rows.push({
        playerId: profile.player_id,
        playerName: profile.player_name || "Unknown Player",
        teamAbbr: profile.team_abbr || "",
        position: position || "",
        eventId: profile.event_id,
        gameId: profile.game_id ?? null,  // Numeric game ID for matching with useNbaGames
        selKey: profile.sel_key,
        gameDate: profile.game_date,
        opponentAbbr: profile.opponent_team_abbr || "",
        homeAway: profile.home_away || "",
        dvpRank,
        dvpQuality,
        primaryLine: profile.line,
        thresholds,
        primaryColor: profile.primary_color || null,
        secondaryColor: profile.secondary_color || null,
      });
    }

    // Sort by player name
    rows.sort((a, b) => a.playerName.localeCompare(b.playerName));

    const responseTime = Date.now() - startTime;
    console.log(`[hit-rate-matrix] ${targetDate}/${market}: ${rows.length} players in ${responseTime}ms`);

    const response: HitRateMatrixResponse = {
      rows,
      market,
      timeWindow,
      thresholdLines: thresholdsForMarket,
      count: rows.length,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    console.error("[hit-rate-matrix] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// Also support GET for simpler fetches
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get("market") || "player_points";
  const gameDate = searchParams.get("date") || undefined;
  const timeWindow = searchParams.get("timeWindow") || "last_10";
  const positionsRaw = searchParams.get("positions");
  const positions = positionsRaw ? positionsRaw.split(",") : undefined;
  
  const body = { market, gameDate, timeWindow, positions };
  const newReq = new NextRequest(req.url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  
  return POST(newReq);
}
