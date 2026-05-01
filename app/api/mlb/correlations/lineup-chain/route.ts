import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface LineupChainLink {
  player_a_id: number;
  player_a_name: string;
  player_a_slot: number;
  player_b_id: number;
  player_b_name: string;
  player_b_slot: number;
  correlation_type: string;
  co_occurrence_pct: number;
  games_together: number;
  games_both_hit: number;
  confidence_tier: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get("game_id");
    const teamId = searchParams.get("team_id");

    if (!gameId) {
      return NextResponse.json({ error: "game_id required" }, { status: 400 });
    }

    const sb = createServerSupabaseClient();

    // If no team_id, look it up from the game (default to away team)
    let resolvedTeamId = teamId ? Number(teamId) : null;
    if (!resolvedTeamId) {
      const { data: game } = await sb
        .from("mlb_games")
        .select("away_id")
        .eq("game_id", Number(gameId))
        .single();
      resolvedTeamId = game?.away_id ?? null;
    }

    if (!resolvedTeamId) {
      return NextResponse.json({ chain: [] });
    }

    const { data, error } = await sb.rpc("get_lineup_chain_correlations", {
      p_game_id: Number(gameId),
      p_team_id: resolvedTeamId,
    });

    if (error) {
      console.error("[Lineup Chain API]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chain: data ?? [] });
  } catch (err: any) {
    console.error("[Lineup Chain API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
