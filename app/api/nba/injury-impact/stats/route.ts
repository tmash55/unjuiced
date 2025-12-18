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
          gameDates: [],
          gameStats: [],
        }
      }, {
        headers: { "Cache-Control": "public, max-age=30" },
      });
    }

    const stats: TeammateOutStats = {
      games: row.games || 0,
      hits: row.hits || 0,
      hitRate: row.hit_rate ? parseFloat(row.hit_rate) : null,
      avgStat: parseFloat(row.avg_stat) || 0,
      avgStatOverall: parseFloat(row.avg_stat_overall) || 0,
      statBoost: parseFloat(row.stat_boost) || 0,
      statBoostPct: row.stat_boost_pct ? parseFloat(row.stat_boost_pct) : null,
      avgMinutes: parseFloat(row.avg_minutes) || 0,
      avgMinutesOverall: parseFloat(row.avg_minutes_overall) || 0,
      minutesBoost: parseFloat(row.minutes_boost) || 0,
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

