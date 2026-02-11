import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { z } from "zod";

/**
 * Get Available Teammates for a Player
 * 
 * Returns all teammates who have been out during a player's games this season.
 * Used to populate the teammate selection dropdown.
 * Sorted by: currently injured first, then by avg minutes (impact).
 */

const RequestSchema = z.object({
  playerId: z.number(),
  market: z.string(),
  season: z.string().optional().default("2025-26"),
});

export interface AvailableTeammate {
  teammateId: number;
  teammateName: string;
  teammatePosition: string;
  currentInjuryStatus: string | null;
  currentInjuryNotes: string | null;
  gamesOut: number;
  avgMinutes: number;
  avgPts: number;
  avgReb: number;
  avgAst: number;
  isCurrentlyInjured: boolean;
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

    const { playerId, market, season } = parsed.data;

    const supabase = await createServerSupabaseClient();

    // Call the RPC function
    const { data, error } = await supabase.rpc("get_available_teammates", {
      p_player_id: playerId,
      p_market: market,
      p_season: season,
    });

    if (error) {
      console.error("[/api/nba/injury-impact/available-teammates] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch available teammates", details: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Transform snake_case to camelCase
    const teammates: AvailableTeammate[] = (data || []).map((row: any) => ({
      teammateId: row.teammate_id,
      teammateName: row.teammate_name,
      teammatePosition: row.teammate_position,
      currentInjuryStatus: row.current_injury_status,
      currentInjuryNotes: row.current_injury_notes,
      gamesOut: row.games_out,
      avgMinutes: parseFloat(row.avg_minutes) || 0,
      avgPts: parseFloat(row.avg_pts) || 0,
      avgReb: parseFloat(row.avg_reb) || 0,
      avgAst: parseFloat(row.avg_ast) || 0,
      isCurrentlyInjured: row.is_currently_injured,
    }));

    return NextResponse.json({ teammates }, {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error: any) {
    console.error("[/api/nba/injury-impact/available-teammates] Error:", error);
    return NextResponse.json(
      { error: "internal_error", message: error?.message || "" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

