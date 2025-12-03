import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

/**
 * Alternate Lines API - Updated for new stable key system
 * 
 * Uses the stable key from odds_selection_id to fetch from props:nba:hitrate
 * Then calculates hit rates for each alternate line using game logs
 */

// Request validation
const RequestSchema = z.object({
  stableKey: z.string().min(1),  // The stable key from odds_selection_id
  playerId: z.number().int().positive(),
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

const REDIS_KEY = "props:nba:hitrate";

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
    if (market === "player_points_rebounds_assists") {
      return (log.pts ?? 0) + (log.reb ?? 0) + (log.ast ?? 0);
    } else if (market === "player_points_rebounds") {
      return (log.pts ?? 0) + (log.reb ?? 0);
    } else if (market === "player_points_assists") {
      return (log.pts ?? 0) + (log.ast ?? 0);
    } else if (market === "player_rebounds_assists") {
      return (log.reb ?? 0) + (log.ast ?? 0);
    } else if (market === "player_blocks_steals") {
      return (log.blk ?? 0) + (log.stl ?? 0);
    }
    return log.market_stat ?? log[MARKET_TO_STAT[market]] ?? null;
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
    if (market === "player_points_rebounds_assists") {
      return (log.pts ?? 0) + (log.reb ?? 0) + (log.ast ?? 0);
    } else if (market === "player_points_rebounds") {
      return (log.pts ?? 0) + (log.reb ?? 0);
    } else if (market === "player_points_assists") {
      return (log.pts ?? 0) + (log.ast ?? 0);
    } else if (market === "player_rebounds_assists") {
      return (log.reb ?? 0) + (log.ast ?? 0);
    } else if (market === "player_blocks_steals") {
      return (log.blk ?? 0) + (log.stl ?? 0);
    }
    return log.market_stat ?? log[MARKET_TO_STAT[market]] ?? null;
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

    const { stableKey, playerId, market, currentLine } = parsed.data;

    // Fetch odds data from Redis using stable key
    const rawRedis = await redis.hget(REDIS_KEY, stableKey);

    if (!rawRedis) {
      return NextResponse.json(
        { error: "No alternate lines found", lines: [], playerName: "", market, currentLine: null },
        { status: 200, headers: { "Cache-Control": "public, max-age=30" } }
      );
    }

    let redisData: any;
    try {
      redisData = typeof rawRedis === "string" ? JSON.parse(rawRedis) : rawRedis;
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Redis data" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const redisLines = redisData?.lines || [];
    const playerName = redisData?.player || "Unknown Player";

    // Fetch game logs from Supabase for hit rate calculations
    const supabase = createServerSupabaseClient();
    
    // First, try to get game logs from the hit rate profile
    const { data: profile } = await supabase
      .from("nba_hit_rate_profiles")
      .select("game_logs")
      .eq("player_id", playerId)
      .eq("market", market)
      .order("game_date", { ascending: false })
      .limit(1)
      .single();

    let gameLogs = profile?.game_logs || [];

    // If we need more games for L20/season, fetch from box scores
    if (gameLogs.length < 20) {
      const statColumn = MARKET_TO_STAT[market];
      
      let selectColumns = "*";
      if (market.includes("points_rebounds_assists")) {
        selectColumns = "game_id, game_date, pts, reb, ast";
      } else if (market.includes("points_rebounds")) {
        selectColumns = "game_id, game_date, pts, reb";
      } else if (market.includes("points_assists")) {
        selectColumns = "game_id, game_date, pts, ast";
      } else if (market.includes("rebounds_assists")) {
        selectColumns = "game_id, game_date, reb, ast";
      } else if (market.includes("blocks_steals")) {
        selectColumns = "game_id, game_date, blk, stl";
      } else if (statColumn) {
        selectColumns = `game_id, game_date, ${statColumn}`;
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

    // Process each alternate line
    const alternateLines: AlternateLine[] = [];

    for (const redisLine of redisLines) {
      const line = redisLine.ln;
      if (typeof line !== "number") continue;

      // Calculate hit rates for this line
      const hitRates = calculateHitRate(gameLogs, line, market);

      // Extract book odds with deep links (including under odds)
      const books: BookOddsWithUnder[] = [];
      const booksData = redisLine.books || {};
      
      // Track sharp book odds for EV calculation
      let sharpOverPrice: number | null = null;
      let sharpUnderPrice: number | null = null;
      let sharpBookUsed: string | null = null;

      for (const [bookKey, bookData] of Object.entries(booksData)) {
        const data = bookData as any;
        const isSharp = SHARP_BOOKS.includes(bookKey.toLowerCase());
        
        if (data?.over?.price !== undefined) {
          books.push({
            book: bookKey,
            price: data.over.price,
            url: data.over.u || null,
            mobileUrl: data.over.m || null,
            underPrice: data.under?.price ?? null,
            underUrl: data.under?.u || null,
            underMobileUrl: data.under?.m || null,
            isSharp,
          });
          
          // Use first available sharp book for EV calculation
          if (isSharp && sharpOverPrice === null && data.over?.price !== undefined && data.under?.price !== undefined) {
            sharpOverPrice = data.over.price;
            sharpUnderPrice = data.under.price;
            sharpBookUsed = bookKey;
          }
        }
      }

      // Sort by best odds (over)
      books.sort((a, b) => b.price - a.price);
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

    // Sort by line (ascending)
    alternateLines.sort((a, b) => a.line - b.line);

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
