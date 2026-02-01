import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

/**
 * Alternate Lines API - Updated for new Redis key structure
 * 
 * Uses new Redis keys:
 * - linesidx:nba:{event_id}:{market}:{player_uuid} (ZSET) - get all lines
 * - odds:nba:{event_id}:{market}:{book} (JSON) - get odds per book
 * 
 * Then calculates hit rates for each alternate line using game logs
 */

// Request validation
const RequestSchema = z.object({
  eventId: z.string().min(1),     // Event/game ID
  selKey: z.string().min(1),      // Player UUID from sel_key (may include :over:line suffix)
  playerId: z.number().int().positive(), // NBA player ID for game logs
  market: z.string().min(1),
  currentLine: z.number().optional(),
});

// Market to stat column mapping for box scores
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

interface BookOdds {
  book: string;
  price: number;
  url: string | null;
  mobileUrl: string | null;
  isSharp?: boolean; // Pinnacle, Circa, etc.
}

interface BookOddsWithUnder extends BookOdds {
  underPrice?: number | null;
  underUrl?: string | null;
  underMobileUrl?: string | null;
}

// Sharp books used for fair odds/EV calculation
const SHARP_BOOKS = ["pinnacle", "circa", "bookmaker"];

interface AlternateLine {
  line: number;
  l5Pct: number | null;
  l10Pct: number | null;
  l20Pct: number | null;
  seasonPct: number | null;
  l5Avg: number | null;
  l10Avg: number | null;
  l20Avg: number | null;
  seasonAvg: number | null;
  bestBook: string | null;
  bestPrice: number | null;
  bestUrl: string | null;
  books: BookOddsWithUnder[];
  isCurrentLine: boolean;
  edge: "strong" | "moderate" | null;
  // EV fields
  evPercent: number | null; // Expected Value percentage
  fairOdds: number | null; // Fair odds based on sharp books
  sharpBook: string | null; // Which sharp book was used
}

interface AlternateLinesResponse {
  lines: AlternateLine[];
  playerName: string;
  market: string;
  currentLine: number | null;
}

// Structure of individual odd entry in Redis
interface RedisOddEntry {
  player_id: string;
  player?: string;
  side: "over" | "under";
  line: number;
  price: string | number;
  link?: string;
  mobile_link?: string;
  sgp?: string;
}

// Odds blob is a hash of "player|side|line" -> odd entry
type RedisOddsBlob = Record<string, RedisOddEntry>;

// Parse price from string or number
function parsePrice(val: string | number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return val;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Calculate hit rate for a given line using game logs
 */
function calculateHitRate(
  gameLogs: any[],
  line: number,
  market: string
): { l5Pct: number | null; l10Pct: number | null; l20Pct: number | null; seasonPct: number | null } {
  if (!gameLogs || gameLogs.length === 0) {
    return { l5Pct: null, l10Pct: null, l20Pct: null, seasonPct: null };
  }

  const stats = gameLogs.map((log) => {
    // First, check if market_stat exists (pre-calculated value from profile)
    // This handles combo markets from profile game_logs
    if (log.market_stat !== undefined && log.market_stat !== null) {
      return log.market_stat;
    }
    
    // For box score data, calculate combo stats from components
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
    
    // For single-stat markets, use the stat column
    return log[MARKET_TO_STAT[market]] ?? null;
  }).filter((v) => v !== null);

  if (stats.length === 0) {
    return { l5Pct: null, l10Pct: null, l20Pct: null, seasonPct: null };
  }

  const calcPct = (arr: number[]) => {
    if (arr.length === 0) return null;
    const hits = arr.filter((v) => v > line).length;
    return Math.round((hits / arr.length) * 1000) / 10;
  };

  return {
    l5Pct: calcPct(stats.slice(0, 5)),
    l10Pct: calcPct(stats.slice(0, 10)),
    l20Pct: calcPct(stats.slice(0, 20)),
    seasonPct: calcPct(stats),
  };
}

/**
 * Calculate average for a given window
 */
function calculateAverage(gameLogs: any[], market: string, window: number): number | null {
  if (!gameLogs || gameLogs.length === 0) return null;

  const stats = gameLogs.slice(0, window).map((log) => {
    // First, check if market_stat exists (pre-calculated value from profile)
    if (log.market_stat !== undefined && log.market_stat !== null) {
      return log.market_stat;
    }
    
    // For box score data, calculate combo stats from components
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
    
    // For single-stat markets, use the stat column
    return log[MARKET_TO_STAT[market]] ?? null;
  }).filter((v) => v !== null);

  if (stats.length === 0) return null;
  return Math.round((stats.reduce((a, b) => a + b, 0) / stats.length) * 10) / 10;
}

/**
 * Detect if there's an edge based on hit rate vs odds
 */
function detectEdge(hitRate: number | null, bestPrice: number | null): "strong" | "moderate" | null {
  if (hitRate === null || bestPrice === null) return null;
  
  const impliedProb = bestPrice > 0 
    ? 100 / (bestPrice + 100) * 100
    : Math.abs(bestPrice) / (Math.abs(bestPrice) + 100) * 100;
  
  const edgePct = hitRate - impliedProb;
  
  if (edgePct >= 15) return "strong";
  if (edgePct >= 8) return "moderate";
  return null;
}

/**
 * Convert American odds to implied probability
 */
function americanToImpliedProb(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

/**
 * Convert implied probability to American odds
 */
function impliedProbToAmerican(prob: number): number {
  if (prob >= 0.5) {
    return Math.round(-100 * prob / (1 - prob));
  } else {
    return Math.round(100 * (1 - prob) / prob);
  }
}

/**
 * Calculate fair odds and EV from sharp book over/under prices
 * Uses no-vig calculation: removes the juice to get true probability
 */
function calculateEV(
  sharpOverPrice: number | null,
  sharpUnderPrice: number | null,
  bestOverPrice: number | null
): { evPercent: number | null; fairOdds: number | null } {
  if (sharpOverPrice === null || sharpUnderPrice === null || bestOverPrice === null) {
    return { evPercent: null, fairOdds: null };
  }

  // Convert to implied probabilities
  const overProb = americanToImpliedProb(sharpOverPrice);
  const underProb = americanToImpliedProb(sharpUnderPrice);
  
  // Total probability (includes vig)
  const totalProb = overProb + underProb;
  
  // Remove vig to get fair probabilities
  const fairOverProb = overProb / totalProb;
  const fairUnderProb = underProb / totalProb;
  
  // Convert fair probability back to American odds
  const fairOdds = impliedProbToAmerican(fairOverProb);
  
  // Calculate EV: (fair probability * potential profit) - (1 - fair probability)
  // For American odds: EV = (fairProb * (bestOdds/100 if positive, or 100/|bestOdds| if negative)) - (1 - fairProb)
  let potentialProfit: number;
  if (bestOverPrice > 0) {
    potentialProfit = bestOverPrice / 100;
  } else {
    potentialProfit = 100 / Math.abs(bestOverPrice);
  }
  
  const evPercent = (fairOverProb * potentialProfit - (1 - fairOverProb)) * 100;
  
  return {
    evPercent: Math.round(evPercent * 10) / 10,
    fairOdds,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { eventId, selKey, playerId, market, currentLine } = parsed.data;

    // Extract player UUID from selKey if it includes side/line (e.g., "uuid:over:20.5" -> "uuid")
    const playerUuid = selKey.includes(':') ? selKey.split(':')[0] : selKey;

    // Step 1: Get all available lines from linesidx ZSET
    const linesKey = `linesidx:nba:${eventId}:${market}:${playerUuid}`;
    const linesRaw = await redis.zrange(linesKey, 0, -1);

    if (!linesRaw || linesRaw.length === 0) {
      console.log(`[alternate-lines] No lines found for key: ${linesKey}`);
      return NextResponse.json(
        { error: "No alternate lines found", lines: [], playerName: "", market, currentLine: null },
        { status: 200, headers: { "Cache-Control": "public, max-age=30" } }
      );
    }

    // Parse lines to numbers and sort
    const lineNumbers = linesRaw
      .map(l => parseFloat(String(l)))
      .filter(l => !isNaN(l))
      .sort((a, b) => a - b);

    // Step 2: Get all books that have odds for this player/event/market
    // We need to scan booksidx for each line to collect all unique books
    const allBooks = new Set<string>();
    const linesBooksMap = new Map<number, string[]>();

    const booksPromises = lineNumbers.map(async (line) => {
      const booksKey = `booksidx:nba:${eventId}:${market}:${playerUuid}:${line}`;
      const books = await redis.smembers(booksKey);
      return { line, books: books || [] };
    });

    const linesBooksResults = await Promise.all(booksPromises);
    
    for (const { line, books } of linesBooksResults) {
      linesBooksMap.set(line, books);
      for (const book of books) {
        allBooks.add(book);
      }
    }

    // Step 3: Fetch odds blobs for all books in parallel
    const oddsPromises = Array.from(allBooks).map(async (book) => {
      const oddsKey = `odds:nba:${eventId}:${market}:${book}`;
      const oddsBlob = await redis.get<RedisOddsBlob>(oddsKey);
      return { book, oddsBlob };
    });

    const oddsResults = await Promise.all(oddsPromises);
    
    // Build a map of book -> odds blob
    const oddsMap = new Map<string, RedisOddsBlob>();
    for (const { book, oddsBlob } of oddsResults) {
      if (oddsBlob && typeof oddsBlob === 'object') {
        oddsMap.set(book, oddsBlob);
      }
    }

    // Step 4: Fetch game logs from Supabase for hit rate calculations
    const supabase = createServerSupabaseClient();
    let gameLogs: any[] = [];
    let playerName = "";
    
    // Try to get game logs from the hit rate profile
    let retries = 2;
    let profile: any = null;
    
    while (retries >= 0) {
      const { data, error } = await supabase
        .from("nba_hit_rate_profiles")
        .select("game_logs, player_name")
        .eq("player_id", playerId)
        .eq("market", market)
        .order("game_date", { ascending: false })
        .limit(1)
        .single();
      
      if (error && (error.code === "503" || error.message?.includes("503") || error.message?.includes("timeout"))) {
        retries--;
        if (retries >= 0) {
          await new Promise(r => setTimeout(r, 300));
          continue;
        }
      }
      profile = data;
      break;
    }

    gameLogs = profile?.game_logs || [];
    playerName = profile?.player_name || "";

    // If we need more games for L20/season, fetch from box scores
    if (gameLogs.length < 20) {
      const isComboMarket = market.includes("points_rebounds") || 
                            market.includes("points_assists") || 
                            market.includes("rebounds_assists") || 
                            market.includes("blocks_steals");
      
      let selectColumns = "game_id, game_date, pts, reb, ast, blk, stl";
      
      if (!isComboMarket) {
        const statColumn = MARKET_TO_STAT[market];
        if (statColumn) {
          selectColumns = `game_id, game_date, ${statColumn}`;
        }
      }

      const { data: boxScores } = await supabase
        .from("nba_player_box_scores")
        .select(selectColumns)
        .eq("player_id", playerId)
        .neq("season_type", "Preseason")
        .order("game_date", { ascending: false })
        .limit(100);

      if (boxScores && boxScores.length > 0) {
        gameLogs = boxScores;
      }
    }

    // Step 5: Process each alternate line
    const alternateLines: AlternateLine[] = [];

    for (const line of lineNumbers) {
      const booksForLine = linesBooksMap.get(line) || [];
      
      // Calculate hit rates for this line
      const hitRates = calculateHitRate(gameLogs, line, market);

      // Extract book odds from odds blobs
      const books: BookOddsWithUnder[] = [];
      let sharpOverPrice: number | null = null;
      let sharpUnderPrice: number | null = null;
      let sharpBookUsed: string | null = null;

      for (const bookKey of booksForLine) {
        const oddsBlob = oddsMap.get(bookKey);
        if (!oddsBlob) continue;

        // Find over and under odds for this player and line
        let overOdd: RedisOddEntry | null = null;
        let underOdd: RedisOddEntry | null = null;

        for (const [key, entry] of Object.entries(oddsBlob)) {
          if (!entry || typeof entry !== 'object' || !entry.player_id) continue;
          
          if (entry.player_id === playerUuid && entry.line === line) {
            if (entry.side === 'over') {
              overOdd = entry;
            } else if (entry.side === 'under') {
              underOdd = entry;
            }
          }
        }

        const overPrice = parsePrice(overOdd?.price);
        const underPrice = parsePrice(underOdd?.price);
        const isSharp = SHARP_BOOKS.includes(bookKey.toLowerCase());

        if (overPrice !== null || underPrice !== null) {
          books.push({
            book: bookKey,
            price: overPrice ?? 0,
            url: overOdd?.link || null,
            mobileUrl: overOdd?.mobile_link || null,
            underPrice: underPrice,
            underUrl: underOdd?.link || null,
            underMobileUrl: underOdd?.mobile_link || null,
            isSharp,
          });

          // Use first available sharp book for EV calculation
          if (isSharp && sharpOverPrice === null && overPrice !== null && underPrice !== null) {
            sharpOverPrice = overPrice;
            sharpUnderPrice = underPrice;
            sharpBookUsed = bookKey;
          }
        }
      }

      // Sort by best odds (over)
      books.sort((a, b) => (b.price || 0) - (a.price || 0));
      const bestBook = books[0] || null;

      // Detect edge
      const edge = detectEdge(hitRates.l10Pct, bestBook?.price || null);
      
      // Calculate EV using sharp book odds
      const { evPercent, fairOdds } = calculateEV(sharpOverPrice, sharpUnderPrice, bestBook?.price || null);

      alternateLines.push({
        line,
        l5Pct: hitRates.l5Pct,
        l10Pct: hitRates.l10Pct,
        l20Pct: hitRates.l20Pct,
        seasonPct: hitRates.seasonPct,
        l5Avg: calculateAverage(gameLogs, market, 5),
        l10Avg: calculateAverage(gameLogs, market, 10),
        l20Avg: calculateAverage(gameLogs, market, 20),
        seasonAvg: calculateAverage(gameLogs, market, 100),
        bestBook: bestBook?.book || null,
        bestPrice: bestBook?.price || null,
        bestUrl: bestBook?.url || null,
        books,
        isCurrentLine: currentLine !== undefined && line === currentLine,
        edge,
        evPercent,
        fairOdds,
        sharpBook: sharpBookUsed,
      });
    }

    console.log(`[alternate-lines] ${eventId}/${market}/${playerUuid}: ${alternateLines.length} lines, ${allBooks.size} books`);

    const response: AlternateLinesResponse = {
      lines: alternateLines,
      playerName,
      market,
      currentLine: currentLine ?? null,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/alternate-lines] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
