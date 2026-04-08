import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export interface PitcherImpactRow {
  threshold_type: string;
  threshold_value: string;
  games_count: number;
  total_games: number;
  pct: number;
  win_pct: number;
  avg_team_runs: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pitcherId = searchParams.get("pitcher_id");
    const gameId = searchParams.get("game_id");
    const side = searchParams.get("side"); // "home" or "away"

    const sb = createServerSupabaseClient();

    // If pitcher_id provided directly, use it
    let resolvedPitcherId = pitcherId ? Number(pitcherId) : null;

    // Otherwise look up from game
    if (!resolvedPitcherId && gameId && side) {
      const { data: game } = await sb
        .from("mlb_games")
        .select("home_probable_pitcher_id, away_probable_pitcher_id")
        .eq("game_id", Number(gameId))
        .single();

      if (game) {
        resolvedPitcherId = side === "home" ? game.home_probable_pitcher_id : game.away_probable_pitcher_id;
      }

      // Fallback: look up from mlb_daily_lineups (pitcher has batting_order = 0 or position = 'P')
      if (!resolvedPitcherId) {
        const teamCol = side === "home" ? "home" : "away";
        const { data: lineup } = await sb
          .from("mlb_daily_lineups")
          .select("player_id")
          .eq("game_id", Number(gameId))
          .eq("side", teamCol)
          .eq("batting_order", 0)
          .limit(1)
          .maybeSingle();
        resolvedPitcherId = lineup?.player_id ?? null;
      }
    }

    if (!resolvedPitcherId) {
      return NextResponse.json({ impact: [], pitcher_id: null });
    }

    const { data, error } = await sb.rpc("get_pitcher_impact_stats", {
      p_pitcher_id: resolvedPitcherId,
    });

    if (error) {
      console.error("[Pitcher Impact API]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ impact: data ?? [], pitcher_id: resolvedPitcherId });
  } catch (err: any) {
    console.error("[Pitcher Impact API] Unexpected:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
