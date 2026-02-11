import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

/**
 * Alt Hit Matrix API
 * 
 * Returns hit rates across multiple line thresholds for multiple players.
 * Shows what % of the time a player would hit at various lines (current, +5, +10, +15, etc.)
 */

// Request validation
const RequestSchema = z.object({
  market: z.string().optional().default("player_points"),
  gameDate: z.string().optional(), // YYYY-MM-DD format
  minGames: z.number().optional().default(5),
  timeWindow: z.enum(["last_5", "last_10", "last_20", "season"]).optional().default("last_10"),
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

// Line thresholds to calculate (relative to current line)
const LINE_OFFSETS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];

// Hit rate color thresholds (matching the player drilldown)
export interface AltHitMatrixRow {
  playerId: number;
  playerName: string;
  teamAbbr: string;
  opponentAbbr: string;
  homeAway: string;
  position: string;
  line: number; // Current line
  market: string;
  gameId: number;
  gameDate: string;
  oddsSelectionId: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  // Hit rates at different line thresholds
  hitRates: {
    line: number;
    offset: number; // How much above the current line
    hitRate: number | null; // 0-100 percentage
    hits: number;
    games: number;
  }[];
  // Best odds info for current line
  bestOdds: number | null;
  bestBook: string | null;
}

export interface AltHitMatrixResponse {
  rows: AltHitMatrixRow[];
  market: string;
  timeWindow: string;
  lineOffsets: number[];
}

/**
 * Calculate hit rate for a given stat value array
 */
function calculateHitRateForLine(stats: number[], line: number): { hitRate: number | null; hits: number; games: number } {
  if (stats.length === 0) return { hitRate: null, hits: 0, games: 0 };
  const hits = stats.filter(v => v > line).length;
  return {
    hitRate: Math.round((hits / stats.length) * 100),
    hits,
    games: stats.length,
  };
}

/**
 * Get stat value from game log based on market
 */
function getStatFromLog(log: any, market: string): number | null {
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
  const statColumn = MARKET_TO_STAT[market];
  return log[statColumn] ?? null;
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

    const { market, gameDate, minGames, timeWindow } = parsed.data;

    // Determine date to use (default to today ET)
    let targetDate = gameDate;
    if (!targetDate) {
      const now = new Date();
      const etOptions: Intl.DateTimeFormatOptions = { 
        timeZone: 'America/New_York', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      };
      targetDate = now.toLocaleDateString('en-CA', etOptions);
    }

    const supabase = await createServerSupabaseClient();

    // Get hit rate profiles for the selected market and date (works for all markets including combo)
    // Join with nba_players to get player name
    const { data: profiles, error: profilesError } = await supabase
      .from("nba_hit_rate_profiles")
      .select(`
        player_id,
        team_id,
        team_abbr,
        opponent_team_abbr,
        home_away,
        position,
        line,
        market,
        game_id,
        game_date,
        odds_selection_id,
        over_price,
        game_logs,
        nba_players_hr!inner (
          name
        ),
        nba_teams!nba_hit_rate_profiles_team_id_fkey (
          primary_color,
          secondary_color
        )
      `)
      .eq("market", market)
      .eq("game_date", targetDate)
      .not("line", "is", null);

    if (profilesError) {
      console.error("[/api/nba/alt-hit-matrix] Profiles error:", profilesError);
      return NextResponse.json(
        { error: "Failed to fetch profiles" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        rows: [],
        market,
        timeWindow,
        lineOffsets: LINE_OFFSETS,
      }, {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }

    // Process each profile to calculate hit rates at various thresholds
    const rows: AltHitMatrixRow[] = [];

    for (const profile of profiles) {
      // Use game_logs from profile (contains market_stat for all markets including combo)
      const gameLogs = profile.game_logs || [];
      
      // Skip if not enough games
      if (gameLogs.length < minGames) continue;
      
      // Get player name from nested nba_players_hr
      const playerName = (profile as any).nba_players_hr?.name || "Unknown Player";

      // Determine window size
      let windowSize: number;
      switch (timeWindow) {
        case "last_5": windowSize = 5; break;
        case "last_10": windowSize = 10; break;
        case "last_20": windowSize = 20; break;
        case "season": windowSize = 100; break;
        default: windowSize = 10;
      }

      // Get stats for the time window
      const stats: number[] = [];
      for (let i = 0; i < Math.min(windowSize, gameLogs.length); i++) {
        const stat = getStatFromLog(gameLogs[i], market);
        if (stat !== null) {
          stats.push(stat);
        }
      }

      if (stats.length < minGames) continue;

      const currentLine = profile.line;

      // Calculate hit rates for each offset
      const hitRates = LINE_OFFSETS.map(offset => {
        const targetLine = currentLine + offset;
        const result = calculateHitRateForLine(stats, targetLine);
        return {
          line: targetLine,
          offset,
          hitRate: result.hitRate,
          hits: result.hits,
          games: result.games,
        };
      });

      // Parse odds for display
      let bestOdds: number | null = null;
      if (profile.over_price) {
        try {
          const oddsStr = String(profile.over_price);
          bestOdds = parseInt(oddsStr, 10);
        } catch {
          // ignore parsing errors
        }
      }

      // Get team colors from nested nba_teams
      const teamData = (profile as any).nba_teams;

      rows.push({
        playerId: profile.player_id,
        playerName,
        teamAbbr: profile.team_abbr,
        opponentAbbr: profile.opponent_team_abbr,
        homeAway: profile.home_away,
        position: profile.position,
        line: currentLine,
        market,
        gameId: profile.game_id,
        gameDate: profile.game_date,
        oddsSelectionId: profile.odds_selection_id,
        primaryColor: teamData?.primary_color || null,
        secondaryColor: teamData?.secondary_color || null,
        hitRates,
        bestOdds,
        bestBook: null, // Would need to look up from Redis
      });
    }

    // Sort by player name
    rows.sort((a, b) => a.playerName.localeCompare(b.playerName));

    const response: AltHitMatrixResponse = {
      rows,
      market,
      timeWindow,
      lineOffsets: LINE_OFFSETS,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/alt-hit-matrix] Error:", error);
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
  
  // Create a new request with the body
  const body = { market, gameDate, timeWindow };
  const newReq = new NextRequest(req.url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  
  return POST(newReq);
}

