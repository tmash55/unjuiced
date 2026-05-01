import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface PropStack {
  player_a_id: number;
  player_a_name: string;
  player_a_slot: number;
  player_b_id: number;
  player_b_name: string;
  player_b_slot: number;
  market_a: string;
  threshold_a: number;
  market_b: string;
  threshold_b: number;
  games_together: number;
  games_a_hit: number;
  games_both_hit: number;
  co_occurrence_pct: number;
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

    // If no team_id, look up both teams from the game and merge results
    if (!teamId) {
      const { data: game } = await sb
        .from("mlb_games")
        .select("home_id, away_id")
        .eq("game_id", Number(gameId))
        .single();

      if (!game) {
        return NextResponse.json({ stacks: [] });
      }

      const [awayResult, homeResult] = await Promise.all([
        sb.rpc("get_prop_stacking_correlations", { p_game_id: Number(gameId), p_team_id: game.away_id, p_min_games: 10 }),
        sb.rpc("get_prop_stacking_correlations", { p_game_id: Number(gameId), p_team_id: game.home_id, p_min_games: 10 }),
      ]);

      const stacks = [...(awayResult.data ?? []), ...(homeResult.data ?? [])];
      stacks.sort((a: PropStack, b: PropStack) => b.co_occurrence_pct - a.co_occurrence_pct);

      return NextResponse.json({ stacks, away_team_id: game.away_id, home_team_id: game.home_id });
    }

    const { data, error } = await sb.rpc("get_prop_stacking_correlations", {
      p_game_id: Number(gameId),
      p_team_id: Number(teamId),
      p_min_games: 10,
    });

    if (error) {
      console.error("[Prop Stacks API]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stacks: data ?? [] });
  } catch (err: any) {
    console.error("[Prop Stacks API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
