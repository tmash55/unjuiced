import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * API route for Hit Rate Cheat Sheet
 * 
 * Calls the get_hit_rate_cheatsheet RPC function to get filtered,
 * ranked prop bets with confidence scores and matchup data.
 */

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
  eventId: string | null;
  
  // Extras
  isBackToBack: boolean;
  injuryStatus: string | null;
  injuryNotes: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
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
    
    const { data, error } = await supabase.rpc("get_hit_rate_cheatsheet", {
      p_time_window: timeWindow,
      p_min_hit_rate: minHitRate,
      p_odds_floor: oddsFloor,
      p_odds_ceiling: oddsCeiling,
      p_markets: markets,
      p_dates: dates,
    });

    if (error) {
      console.error("[Cheat Sheet] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch cheat sheet data", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Transform snake_case to camelCase
    const rows: CheatSheetRow[] = (data || []).map((row: any) => ({
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
      eventId: row.event_id,
      isBackToBack: row.is_back_to_back,
      injuryStatus: row.injury_status,
      injuryNotes: row.injury_notes,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
    }));

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
    console.error("[Cheat Sheet] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// GET endpoint for simple fetching with query params
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const timeWindow = searchParams.get("timeWindow") || "last_10_pct";
  const minHitRate = parseFloat(searchParams.get("minHitRate") || "0.80");
  const oddsFloor = parseInt(searchParams.get("oddsFloor") || "-300");
  const oddsCeiling = parseInt(searchParams.get("oddsCeiling") || "200");
  const markets = searchParams.get("markets")?.split(",").filter(Boolean) || null;
  const dates = searchParams.get("dates")?.split(",").filter(Boolean) || null;

  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase.rpc("get_hit_rate_cheatsheet", {
    p_time_window: timeWindow,
    p_min_hit_rate: minHitRate,
    p_odds_floor: oddsFloor,
    p_odds_ceiling: oddsCeiling,
    p_markets: markets,
    p_dates: dates,
  });

  if (error) {
    console.error("[Cheat Sheet] Supabase error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cheat sheet data", details: error.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Transform snake_case to camelCase
  const rows: CheatSheetRow[] = (data || []).map((row: any) => ({
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
    eventId: row.event_id,
    isBackToBack: row.is_back_to_back,
    injuryStatus: row.injury_status,
    injuryNotes: row.injury_notes,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
  }));

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

