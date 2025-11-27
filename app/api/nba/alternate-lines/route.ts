import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

// Request validation
const RequestSchema = z.object({
  sid: z.string().min(1),
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
  // Combo markets need special handling
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
}

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
  books: BookOdds[];
  isCurrentLine: boolean;
  edge: "strong" | "moderate" | null; // Edge detection
}

interface AlternateLinesResponse {
  lines: AlternateLine[];
  playerName: string;
  market: string;
  currentLine: number | null;
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

  // Get the stat value from each game log
  const stats = gameLogs.map((log) => {
    // Handle combo markets
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
    
    // Simple markets - use market_stat if available, otherwise look up the stat
    return log.market_stat ?? log[MARKET_TO_STAT[market]] ?? null;
  }).filter((v) => v !== null);

  if (stats.length === 0) {
    return { l5Pct: null, l10Pct: null, l20Pct: null, seasonPct: null };
  }

  const calcPct = (arr: number[]) => {
    if (arr.length === 0) return null;
    const hits = arr.filter((v) => v > line).length;
    return Math.round((hits / arr.length) * 1000) / 10; // One decimal place
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
 * Strong edge: >75% hit rate with -130 or worse odds
 * Moderate edge: >65% hit rate with -120 or worse odds
 */
function detectEdge(hitRate: number | null, bestPrice: number | null): "strong" | "moderate" | null {
  if (hitRate === null || bestPrice === null) return null;
  
  // Convert American odds to implied probability
  const impliedProb = bestPrice > 0 
    ? 100 / (bestPrice + 100) * 100
    : Math.abs(bestPrice) / (Math.abs(bestPrice) + 100) * 100;
  
  // Edge = actual hit rate significantly higher than implied probability
  const edgePct = hitRate - impliedProb;
  
  if (edgePct >= 15) return "strong";
  if (edgePct >= 8) return "moderate";
  return null;
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

    const { sid, playerId, market, currentLine } = parsed.data;

    // Fetch alternate lines from Redis
    const redisKey = `props:nba:rows:alt:${sid}`;
    const rawRedis = await redis.get(redisKey);

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

    // Fetch game logs from Supabase (we need more than what's in the profile for L20/season)
    const supabase = createServerSupabaseClient();
    
    // First, try to get game logs from the hit rate profile
    const { data: profile } = await supabase
      .from("nba_hit_rate_profiles")
      .select("game_logs, nba_players_hr(name)")
      .eq("player_id", playerId)
      .eq("market", market)
      .order("game_date", { ascending: false })
      .limit(1)
      .single();

    let gameLogs = profile?.game_logs || [];
    const playerName = (profile?.nba_players_hr as any)?.name || "Unknown Player";

    // If we need more games for L20/season, fetch from box scores
    if (gameLogs.length < 20) {
      const statColumn = MARKET_TO_STAT[market];
      
      // For combo markets, we need to fetch multiple columns
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

      // Extract book odds
      const books: BookOdds[] = [];
      const booksData = redisLine.books || {};

      for (const [bookKey, bookData] of Object.entries(booksData)) {
        const data = bookData as any;
        if (data?.over?.price !== undefined) {
          books.push({
            book: bookKey,
            price: data.over.price,
            url: data.over.u || null,
            mobileUrl: data.over.m || null,
          });
        }
      }

      // Sort by best odds
      books.sort((a, b) => b.price - a.price);
      const bestBook = books[0] || null;

      // Detect edge
      const edge = detectEdge(hitRates.l10Pct, bestBook?.price || null);

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

