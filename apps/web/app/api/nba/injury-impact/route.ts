import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { redis } from "@/lib/redis";
import { z } from "zod";

/**
 * Injury Impact Cheat Sheet API
 * 
 * Returns players with odds where a high-impact teammate is injured.
 * Shows how players perform when specific teammates are out.
 * 
 * Also fetches best odds from Redis (bestodds:nba:* keys) for each row.
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

// =============================================================================
// REDIS BEST ODDS HELPERS
// =============================================================================

/**
 * Batch fetch best odds from Redis for all rows with valid keys
 */
async function fetchBestOddsForRows(
  rows: Array<{ event_id?: string; market?: string; sel_key?: string }>
): Promise<Map<string, BestOddsData | null>> {
  const result = new Map<string, BestOddsData | null>();
  
  // Filter rows that have all required fields for Redis lookup
  const validRows = rows.filter(r => r.event_id && r.market && r.sel_key);
  
  if (validRows.length === 0) {
    return result;
  }
  
  // Build Redis keys - format: bestodds:nba:{eventId}:{market}:{selKey}
  const keys = validRows.map(r => `bestodds:nba:${r.event_id}:${r.market}:${r.sel_key}`);
  
  try {
    // Batch fetch all keys in one round trip
    const values = await redis.mget<(BestOddsData | null)[]>(...keys);
    
    // Map results back to composite keys for easy lookup
    validRows.forEach((row, i) => {
      const compositeKey = `${row.event_id}:${row.market}:${row.sel_key}`;
      const value = values[i];
      
      // Handle both string and object responses from Redis
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
    console.error("[Injury Impact] Redis best odds fetch error:", e);
    // Return empty map on error - gracefully degrade
  }
  
  return result;
}

const RequestSchema = z.object({
  dates: z.array(z.string()).optional().nullable(),
  markets: z.array(z.string()).optional().nullable(),
  minGames: z.number().optional().default(2),
  minTeammateMinutes: z.number().optional().default(15),
  season: z.string().optional().default("2025-26"),
});

export interface InjuryImpactRow {
  // Player info
  playerId: number;
  playerName: string;
  teamAbbr: string;
  teamId: number;
  playerPosition: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  
  // Game info
  gameDate: string;
  gameId: number;
  opponentAbbr: string;
  opponentId: number;
  homeAway: string;
  
  // Bet info
  market: string;
  line: number;
  overOdds: string | null;
  overOddsDecimal: number | null;
  oddsSelectionId: string | null;
  eventId: string | null;
  
  // Default injured teammate
  defaultTeammateId: number;
  defaultTeammateName: string;
  defaultTeammatePosition: string;
  defaultTeammateInjuryStatus: string;
  defaultTeammateInjuryNotes: string | null;
  defaultTeammateAvgMinutes: number;
  defaultTeammateAvgPts: number;
  defaultTeammateAvgReb: number;
  defaultTeammateAvgAst: number;
  
  // Stats when teammate is out
  gamesWithTeammateOut: number;
  hits: number;
  hitRate: number | null;
  avgStatWhenOut: number;
  avgStatOverall: number;
  statBoost: number;
  statBoostPct: number | null;
  avgMinutesWhenOut: number;
  avgMinutesOverall: number;
  minutesBoost: number;
  
  // Additional stat boosts
  usageWhenOut: number;
  usageOverall: number;
  usageBoost: number;
  fgaWhenOut: number;
  fgaOverall: number;
  fgaBoost: number;
  fg3aWhenOut: number;
  fg3aOverall: number;
  fg3aBoost: number;
  
  // Rebound stats
  orebWhenOut: number;
  orebOverall: number;
  orebBoost: number;
  drebWhenOut: number;
  drebOverall: number;
  drebBoost: number;
  rebWhenOut: number;
  rebOverall: number;
  rebBoost: number;
  
  // Playmaking stats
  passesWhenOut: number;
  passesOverall: number;
  passesBoost: number;
  potentialAstWhenOut: number;
  potentialAstOverall: number;
  potentialAstBoost: number;
  
  // Additional info
  otherInjuredTeammatesCount: number;
  opportunityGrade: string;
  confidenceScore: number;
  
  // Best odds from Redis (for immediate display)
  bestOdds: {
    book: string;
    price: number;
    updated_at: number;
  } | null;
  books: number; // Number of sportsbooks with odds
  selKey: string | null; // Key used for Redis odds lookup
}

export interface InjuryImpactResponse {
  rows: InjuryImpactRow[];
  markets: string[];
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

    const { dates, markets, minGames, minTeammateMinutes, season } = parsed.data;

    const supabase = await createServerSupabaseClient();

    // Call the RPC function
    const { data, error } = await supabase.rpc("get_teammate_out_cheatsheet", {
      p_dates: dates || null,
      p_markets: markets || null,
      p_min_games: minGames,
      p_min_teammate_minutes: minTeammateMinutes,
      p_season: season,
    });

    if (error) {
      console.error("[/api/nba/injury-impact] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch injury impact data", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rawRows = data || [];
    
    // Fetch best odds from Redis for all rows
    const bestOddsMap = await fetchBestOddsForRows(
      rawRows.map((row: any) => ({
        event_id: row.event_id,
        market: row.market,
        sel_key: row.odds_selection_id, // odds_selection_id contains the sel_key
      }))
    );

    // Transform snake_case to camelCase and merge best odds
    const rows: InjuryImpactRow[] = rawRows.map((row: any) => {
      const compositeKey = `${row.event_id}:${row.market}:${row.odds_selection_id}`;
      const bestOddsData = bestOddsMap.get(compositeKey);
      
      return {
      playerId: row.player_id,
      playerName: row.player_name,
      teamAbbr: row.team_abbr,
      teamId: row.team_id,
      playerPosition: row.player_position,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      
      gameDate: row.game_date,
      gameId: row.game_id,
      opponentAbbr: row.opponent_abbr,
      opponentId: row.opponent_id,
      homeAway: row.home_away,
      
      market: row.market,
      line: parseFloat(row.line),
      overOdds: row.over_odds,
      overOddsDecimal: row.over_odds_decimal ? parseFloat(row.over_odds_decimal) : null,
      oddsSelectionId: row.odds_selection_id || null,
      eventId: row.event_id || null,
      
      defaultTeammateId: row.default_teammate_id,
      defaultTeammateName: row.default_teammate_name,
      defaultTeammatePosition: row.default_teammate_position,
      defaultTeammateInjuryStatus: row.default_teammate_injury_status,
      defaultTeammateInjuryNotes: row.default_teammate_injury_notes,
      defaultTeammateAvgMinutes: parseFloat(row.default_teammate_avg_minutes) || 0,
      defaultTeammateAvgPts: parseFloat(row.default_teammate_avg_pts) || 0,
      defaultTeammateAvgReb: parseFloat(row.default_teammate_avg_reb) || 0,
      defaultTeammateAvgAst: parseFloat(row.default_teammate_avg_ast) || 0,
      
      gamesWithTeammateOut: row.games_with_teammate_out,
      hits: row.hits,
      hitRate: row.hit_rate ? parseFloat(row.hit_rate) : null,
      avgStatWhenOut: parseFloat(row.avg_stat_when_out) || 0,
      avgStatOverall: parseFloat(row.avg_stat_overall) || 0,
      statBoost: parseFloat(row.stat_boost) || 0,
      statBoostPct: row.stat_boost_pct ? parseFloat(row.stat_boost_pct) : null,
      avgMinutesWhenOut: parseFloat(row.avg_minutes_when_out) || 0,
      avgMinutesOverall: parseFloat(row.avg_minutes_overall) || 0,
      minutesBoost: parseFloat(row.minutes_boost) || 0,
      
      // Additional stat boosts
      usageWhenOut: parseFloat(row.usage_when_out) || 0,
      usageOverall: parseFloat(row.usage_overall) || 0,
      usageBoost: parseFloat(row.usage_boost) || 0,
      fgaWhenOut: parseFloat(row.fga_when_out) || 0,
      fgaOverall: parseFloat(row.fga_overall) || 0,
      fgaBoost: parseFloat(row.fga_boost) || 0,
      fg3aWhenOut: parseFloat(row.fg3a_when_out) || 0,
      fg3aOverall: parseFloat(row.fg3a_overall) || 0,
      fg3aBoost: parseFloat(row.fg3a_boost) || 0,
      
      // Rebound stats
      orebWhenOut: parseFloat(row.oreb_when_out) || 0,
      orebOverall: parseFloat(row.oreb_overall) || 0,
      orebBoost: parseFloat(row.oreb_boost) || 0,
      drebWhenOut: parseFloat(row.dreb_when_out) || 0,
      drebOverall: parseFloat(row.dreb_overall) || 0,
      drebBoost: parseFloat(row.dreb_boost) || 0,
      rebWhenOut: parseFloat(row.reb_when_out) || 0,
      rebOverall: parseFloat(row.reb_overall) || 0,
      rebBoost: parseFloat(row.reb_boost) || 0,
      
      // Playmaking stats
      passesWhenOut: parseFloat(row.passes_when_out) || 0,
      passesOverall: parseFloat(row.passes_overall) || 0,
      passesBoost: parseFloat(row.passes_boost) || 0,
      potentialAstWhenOut: parseFloat(row.potential_ast_when_out) || 0,
      potentialAstOverall: parseFloat(row.potential_ast_overall) || 0,
      potentialAstBoost: parseFloat(row.potential_ast_boost) || 0,
      
      otherInjuredTeammatesCount: row.other_injured_teammates_count || 0,
      opportunityGrade: row.opportunity_grade || "C",
      confidenceScore: parseFloat(row.confidence_score) || 0,
      
      // Best odds from Redis
      bestOdds: bestOddsData ? {
        book: bestOddsData.best_book,
        price: bestOddsData.best_price,
        updated_at: bestOddsData.updated_at,
      } : null,
      books: bestOddsData?.book_count ?? 0,
      selKey: row.odds_selection_id || null,
    };
    });

    // Get unique markets from results
    const uniqueMarkets = [...new Set(rows.map(r => r.market))];

    const response: InjuryImpactResponse = {
      rows,
      markets: uniqueMarkets,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/injury-impact] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// Also support GET for simpler fetches
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const markets = searchParams.get("markets")?.split(",").filter(Boolean) || null;
  const dates = searchParams.get("dates")?.split(",").filter(Boolean) || null;
  
  const body = { markets, dates };
  const newReq = new NextRequest(req.url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  
  return POST(newReq);
}

