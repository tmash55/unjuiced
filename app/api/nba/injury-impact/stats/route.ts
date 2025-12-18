import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

/**
 * Calculate Teammate Out Stats
 * 
 * Dynamic calculation when user selects specific teammates.
 * Finds games where ALL selected teammates were out.
 * Useful for "when both X and Y are out" scenarios.
 */

const RequestSchema = z.object({
  playerId: z.number(),
  teammateIds: z.array(z.number()),
  market: z.string(),
  line: z.number(),
  season: z.string().optional().default("2025-26"),
});

export interface TeammateOutStats {
  games: number;
  hits: number;
  hitRate: number | null;
  avgStat: number;
  avgStatOverall: number;
  statBoost: number;
  statBoostPct: number | null;
  avgMinutes: number;
  avgMinutesOverall: number;
  minutesBoost: number;
  // Additional stats
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
  // Game arrays
  gameDates: string[];
  gameStats: number[];
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

    const { playerId, teammateIds, market, line, season } = parsed.data;

    if (teammateIds.length === 0) {
      return NextResponse.json(
        { error: "At least one teammate must be selected" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Call the RPC function
    const { data, error } = await supabase.rpc("get_teammate_out_stats", {
      p_player_id: playerId,
      p_teammate_ids: teammateIds,
      p_market: market,
      p_line: line,
      p_season: season,
    });

    if (error) {
      console.error("[/api/nba/injury-impact/stats] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to calculate stats", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // The RPC returns a single row
    const row = data?.[0];
    
    if (!row) {
      return NextResponse.json({
        stats: {
          games: 0,
          hits: 0,
          hitRate: null,
          avgStat: 0,
          avgStatOverall: 0,
          statBoost: 0,
          statBoostPct: null,
          avgMinutes: 0,
          avgMinutesOverall: 0,
          minutesBoost: 0,
          usageWhenOut: 0,
          usageOverall: 0,
          usageBoost: 0,
          fgaWhenOut: 0,
          fgaOverall: 0,
          fgaBoost: 0,
          fg3aWhenOut: 0,
          fg3aOverall: 0,
          fg3aBoost: 0,
          orebWhenOut: 0,
          orebOverall: 0,
          orebBoost: 0,
          drebWhenOut: 0,
          drebOverall: 0,
          drebBoost: 0,
          rebWhenOut: 0,
          rebOverall: 0,
          rebBoost: 0,
          passesWhenOut: 0,
          passesOverall: 0,
          passesBoost: 0,
          potentialAstWhenOut: 0,
          potentialAstOverall: 0,
          potentialAstBoost: 0,
          gameDates: [],
          gameStats: [],
        }
      }, {
        headers: { "Cache-Control": "public, max-age=30" },
      });
    }

    // Helper to safely parse float
    const getFloat = (val: any) => (val !== null && val !== undefined) ? parseFloat(val) : 0;
    
    const stats: TeammateOutStats = {
      games: row.games || 0,
      hits: row.hits || 0,
      hitRate: row.hit_rate !== null ? parseFloat(row.hit_rate) : null,
      avgStat: getFloat(row.avg_stat),
      avgStatOverall: getFloat(row.avg_stat_overall),
      statBoost: getFloat(row.stat_boost),
      statBoostPct: row.stat_boost_pct !== null ? parseFloat(row.stat_boost_pct) : null,
      avgMinutes: getFloat(row.avg_minutes),
      avgMinutesOverall: getFloat(row.avg_minutes_overall),
      minutesBoost: getFloat(row.minutes_boost),
      // Additional stats
      usageWhenOut: getFloat(row.usage_when_out),
      usageOverall: getFloat(row.usage_overall),
      usageBoost: getFloat(row.usage_boost),
      fgaWhenOut: getFloat(row.fga_when_out),
      fgaOverall: getFloat(row.fga_overall),
      fgaBoost: getFloat(row.fga_boost),
      fg3aWhenOut: getFloat(row.fg3a_when_out),
      fg3aOverall: getFloat(row.fg3a_overall),
      fg3aBoost: getFloat(row.fg3a_boost),
      // Rebound stats
      orebWhenOut: getFloat(row.oreb_when_out),
      orebOverall: getFloat(row.oreb_overall),
      orebBoost: getFloat(row.oreb_boost),
      drebWhenOut: getFloat(row.dreb_when_out),
      drebOverall: getFloat(row.dreb_overall),
      drebBoost: getFloat(row.dreb_boost),
      rebWhenOut: getFloat(row.reb_when_out),
      rebOverall: getFloat(row.reb_overall),
      rebBoost: getFloat(row.reb_boost),
      // Playmaking stats
      passesWhenOut: getFloat(row.passes_when_out),
      passesOverall: getFloat(row.passes_overall),
      passesBoost: getFloat(row.passes_boost),
      potentialAstWhenOut: getFloat(row.potential_ast_when_out),
      potentialAstOverall: getFloat(row.potential_ast_overall),
      potentialAstBoost: getFloat(row.potential_ast_boost),
      // Game arrays
      gameDates: row.game_dates || [],
      gameStats: (row.game_stats || []).map((s: any) => parseFloat(s) || 0),
    };

    return NextResponse.json({ stats }, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/injury-impact/stats] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

