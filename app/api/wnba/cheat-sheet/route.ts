import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";

/**
 * API route for WNBA Hit Rate Cheat Sheet
 *
 * Calls get_wnba_hit_rate_cheatsheet_v2 RPC, mirroring the NBA cheat sheet
 * but targeting wnba_hit_rate_profiles_v2 and wnba tables.
 * Also fetches best odds from Redis (bestodds:wnba:* keys) for each row.
 */

// =============================================================================
// TYPES
// =============================================================================

interface BestOddsData {
  best_book: string;
  best_price: number;
  line: number;
  side: string;
  player_id: string;
  player_name: string;
  book_count: number;
  updated_at: number;
}

export interface CheatSheetRow {
  // Player/Game Context
  playerId: number;
  playerName: string;
  teamAbbr: string;
  teamName: string;
  opponentAbbr: string;
  opponentName: string;
  playerPosition: string;
  gameDate: string;
  gameId: number;
  homeAway: string;

  // Game Details
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  homeTeamName: string;
  awayTeamName: string;
  gameStatus: string;
  startTime: string | null;

  // Betting Line Info
  market: string;
  line: number;
  overOdds: string;
  overOddsDecimal: number;

  // Hit Rates
  hitRate: number;
  last5Pct: number;
  last10Pct: number;
  last20Pct: number;
  seasonPct: number;
  hitStreak: number;

  // Edge Calculations
  avgStat: number;
  edge: number;
  edgePct: number;

  // Matchup Context
  dvpRank: number | null;
  dvpAvg: number | null;
  matchupQuality: "favorable" | "neutral" | "unfavorable";

  // Confidence Metrics
  confidenceGrade: "A+" | "A" | "B+" | "B" | "C";
  confidenceScore: number;
  trend: "hot" | "improving" | "stable" | "declining" | "cold";

  // For Odds Fetching
  oddsSelectionId: string | null;
  selKey: string | null;
  eventId: string | null;

  // Best odds from Redis
  bestOdds: {
    book: string;
    price: number;
    updated_at: number;
  } | null;
  books: number;

  // Extras
  isBackToBack: boolean;
  injuryStatus: string | null;
  injuryNotes: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

// =============================================================================
// REDIS BEST ODDS HELPERS
// =============================================================================

async function fetchBestOddsForRows(
  rows: Array<{ event_id?: string; market?: string; sel_key?: string }>
): Promise<Map<string, BestOddsData | null>> {
  const result = new Map<string, BestOddsData | null>();

  const validRows = rows.filter(r => r.event_id && r.market && r.sel_key);

  if (validRows.length === 0) {
    return result;
  }

  // Build Redis keys - format: bestodds:wnba:{eventId}:{market}:{selKey}
  const keys = validRows.map(r => `bestodds:wnba:${r.event_id}:${r.market}:${r.sel_key}`);

  try {
    const values = await redis.mget<(BestOddsData | null)[]>(...keys);

    validRows.forEach((row, i) => {
      const compositeKey = `${row.event_id}:${row.market}:${row.sel_key}`;
      const value = values[i];

      if (value) {
        if (typeof value === 'string') {
          try {
            result.set(compositeKey, JSON.parse(value));
          } catch {
            result.set(compositeKey, null);
          }
        } else {
          result.set(compositeKey, value);
        }
      } else {
        result.set(compositeKey, null);
      }
    });
  } catch (e) {
    console.error("[Cheat Sheet WNBA] Redis best odds fetch error:", e);
  }

  return result;
}

// Request body interface
interface CheatSheetRequest {
  timeWindow?: "last_5_pct" | "last_10_pct" | "last_20_pct" | "season_pct";
  minHitRate?: number;
  oddsFloor?: number;
  oddsCeiling?: number;
  markets?: string[];
  dates?: string[];
}

function transformRows(rawRows: any[], bestOddsMap: Map<string, BestOddsData | null>): CheatSheetRow[] {
  return rawRows.map((row: any) => {
    const compositeKey = `${row.event_id}:${row.market}:${row.odds_selection_id}`;
    const bestOddsData = bestOddsMap.get(compositeKey);

    return {
      playerId: row.player_id,
      playerName: row.player_name,
      teamAbbr: row.team_abbr,
      teamName: row.team_name,
      opponentAbbr: row.opponent_abbr,
      opponentName: row.opponent_name,
      playerPosition: row.player_position,
      gameDate: row.game_date,
      gameId: row.game_id,
      homeAway: row.home_away,
      homeTeamAbbr: row.home_team_abbr,
      awayTeamAbbr: row.away_team_abbr,
      homeTeamName: row.home_team_name,
      awayTeamName: row.away_team_name,
      gameStatus: row.game_status,
      startTime: row.start_time ?? row.commence_time ?? null,
      market: row.market,
      line: row.line,
      overOdds: row.over_odds,
      overOddsDecimal: row.over_odds_decimal,
      hitRate: row.hit_rate,
      last5Pct: row.last_5_pct,
      last10Pct: row.last_10_pct,
      last20Pct: row.last_20_pct,
      seasonPct: row.season_pct,
      hitStreak: row.hit_streak,
      avgStat: row.avg_stat,
      edge: row.edge,
      edgePct: row.edge_pct,
      dvpRank: row.dvp_rank,
      dvpAvg: row.dvp_avg,
      matchupQuality: row.matchup_quality,
      confidenceGrade: row.confidence_grade,
      confidenceScore: row.confidence_score,
      trend: row.trend,
      oddsSelectionId: row.odds_selection_id,
      selKey: row.odds_selection_id,
      eventId: row.event_id,
      bestOdds: bestOddsData ? {
        book: bestOddsData.best_book,
        price: bestOddsData.best_price,
        updated_at: bestOddsData.updated_at,
      } : null,
      books: bestOddsData?.book_count ?? 0,
      isBackToBack: row.is_back_to_back,
      injuryStatus: row.injury_status,
      injuryNotes: row.injury_notes,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body: CheatSheetRequest = await req.json().catch(() => ({}));

    const {
      timeWindow = "last_10_pct",
      minHitRate = 0.80,
      oddsFloor = -300,
      oddsCeiling = 200,
      markets = null,
      dates = null,
    } = body;

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_wnba_hit_rate_cheatsheet_v2", {
      p_time_window: timeWindow,
      p_min_hit_rate: minHitRate,
      // WNBA profiles are built from season averages and have no live odds yet.
      // Pass null so the RPC skips the odds filter rather than eliminating all rows.
      p_odds_floor: null,
      p_odds_ceiling: null,
      p_markets: markets,
      p_dates: dates,
    });

    if (error) {
      console.error("[Cheat Sheet WNBA] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch cheat sheet data", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rawRows = data || [];

    const bestOddsMap = await fetchBestOddsForRows(
      rawRows.map((row: any) => ({
        event_id: row.event_id,
        market: row.market,
        sel_key: row.odds_selection_id,
      }))
    );

    const rows = transformRows(rawRows, bestOddsMap);

    return NextResponse.json(
      { rows, count: rows.length },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
        }
      }
    );
  } catch (err) {
    console.error("[Cheat Sheet WNBA] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const timeWindow = searchParams.get("timeWindow") || "last_10_pct";
  const minHitRate = parseFloat(searchParams.get("minHitRate") || "0.80");
  const oddsFloor = parseInt(searchParams.get("oddsFloor") || "-300");
  const oddsCeiling = parseInt(searchParams.get("oddsCeiling") || "200");
  const markets = searchParams.get("markets")?.split(",").filter(Boolean) || null;
  const dates = searchParams.get("dates")?.split(",").filter(Boolean) || null;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("get_wnba_hit_rate_cheatsheet_v2", {
    p_time_window: timeWindow,
    p_min_hit_rate: minHitRate,
    p_odds_floor: null,
    p_odds_ceiling: null,
    p_markets: markets,
    p_dates: dates,
  });

  if (error) {
    console.error("[Cheat Sheet WNBA] Supabase error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cheat sheet data", details: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rawRows = data || [];

  const bestOddsMap = await fetchBestOddsForRows(
    rawRows.map((row: any) => ({
      event_id: row.event_id,
      market: row.market,
      sel_key: row.odds_selection_id,
    }))
  );

  const rows = transformRows(rawRows, bestOddsMap);

  return NextResponse.json(
    { rows, count: rows.length },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
      }
    }
  );
}
